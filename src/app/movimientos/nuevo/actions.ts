'use server';
import { requireAuth } from '@/lib/auth';

import { db } from '@/db';
import { transactions, transaction_splits, payment_methods, people, installment_groups, cards } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { calculateCardBillingMonth, addMonths } from '@/lib/card-billing';

function parseMoneyToCents(value: string): number | null {
  if (!value) return null;
  let clean = value.trim();

  // Si tiene puntos de miles y coma decimal (ej: 200.000,50)
  if (clean.includes('.') && clean.includes(',')) {
    clean = clean.replace(/\./g, '').replace(',', '.');
  } else if (clean.includes(',')) {
    clean = clean.replace(',', '.');
  } else if (/\.\d{3}/.test(clean) && !/\.\d{1,2}$/.test(clean)) {
    // Si tiene puntos como separadores de miles (ej: 200.000 o 1.500.000)
    clean = clean.replace(/\./g, '');
  }

  if (!/^\d+(?:\.\d{1,2})?$/.test(clean)) return null;
  const [whole, decimal = ''] = clean.split('.');
  const cents = Number(whole) * 100 + Number(decimal.padEnd(2, '0'));
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

function parseSplitToCents(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  const cents = Math.round(value * 100);
  return Number.isSafeInteger(cents) && Number((cents / 100).toFixed(2)) === value ? cents : null;
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function parseInstallment(value: string | undefined, label: string): number | string {
  if (!value) return 1;
  if (!/^\d+$/.test(value)) return `${label} debe ser un número entero entre 1 y 120`;
  const installment = Number(value);
  return installment >= 1 && installment <= 120 ? installment : `${label} debe ser un número entero entre 1 y 120`;
}

export async function createTransactionAction(prevState: any, formData: FormData) {
  await requireAuth();
  const type = formData.get('type')?.toString();
  const date = formData.get('date')?.toString();
  const amountStr = formData.get('amount')?.toString();
  const description = formData.get('description')?.toString()?.trim();
  const payer_person_id = formData.get('payer_person_id')?.toString();
  const payment_method_id = formData.get('payment_method_id')?.toString();
  const splitsJson = formData.get('splits')?.toString();
  const installmentsTotalStr = formData.get('installments_total')?.toString();
  const startingInstallmentStr = formData.get('starting_installment')?.toString();
  const impactMonthStr = formData.get('impact_month')?.toString()?.trim();

  if (!type || !date || !amountStr || !description || !payer_person_id || !payment_method_id || !splitsJson) {
    return { error: 'Faltan campos obligatorios' };
  }

  if (type !== 'income' && type !== 'expense') {
    return { error: 'Tipo de movimiento inválido' };
  }

  if (!isValidDate(date)) {
    return { error: 'La fecha debe ser válida y tener formato AAAA-MM-DD' };
  }

  const amountCents = parseMoneyToCents(amountStr);
  if (amountCents === null) {
    return { error: 'El monto debe ser positivo y tener como máximo dos decimales' };
  }

  let splits: Array<{ person_id: string; amount: number }> = [];
  try {
    splits = JSON.parse(splitsJson);
    if (!Array.isArray(splits) || splits.length === 0) {
      return { error: 'Se requiere al menos un responsable (split)' };
    }
  } catch {
    return { error: 'Formato de splits inválido' };
  }

  let splitsTotalCents = 0;
  const parsedSplits: Array<{ person_id: string; amount: number }> = [];

  for (const split of splits) {
    if (!split.person_id || typeof split.amount !== 'number') {
      return { error: 'Datos de split incompletos' };
    }
    const splitAmountCents = parseSplitToCents(split.amount);
    if (splitAmountCents === null) return { error: 'Cada split debe ser un monto no negativo con máximo dos decimales' };
    splitsTotalCents += splitAmountCents;
    parsedSplits.push({ person_id: split.person_id, amount: splitAmountCents });
  }

  if (splitsTotalCents !== amountCents) {
    return { error: `La suma de las divisiones ($${(splitsTotalCents / 100).toFixed(2)}) no coincide con el total ($${(amountCents / 100).toFixed(2)})` };
  }

  const splitPersonIds = parsedSplits.map((split) => split.person_id);
  if (new Set(splitPersonIds).size !== splitPersonIds.length) {
    return { error: 'Cada persona puede aparecer una sola vez en las divisiones' };
  }

  const pm = await db.select().from(payment_methods).where(eq(payment_methods.id, payment_method_id)).get();
  const payer = await db.select().from(people).where(eq(people.id, payer_person_id)).get();
  const splitPeople = await db.select({ id: people.id }).from(people).where(inArray(people.id, splitPersonIds));

  if (!pm) return { error: 'Medio de pago no encontrado' };
  if (!payer) return { error: 'La persona que paga no existe' };
  if (splitPeople.length !== splitPersonIds.length) {
    return { error: 'Una o más personas de las divisiones no existen' };
  }
  if (pm.type === 'credit_card' && type !== 'expense') {
    return { error: 'Las tarjetas solo pueden usarse para egresos' };
  }
  if (pm.type === 'credit_card' && !pm.card_id) {
    return { error: 'El medio de pago de tarjeta no tiene una tarjeta asociada' };
  }

  let card = null;
  if (pm.type === 'credit_card' && pm.card_id) {
    card = await db.select().from(cards).where(eq(cards.id, pm.card_id)).get();
  }

  let billingMonth = date.substring(0, 7);
  if (pm.type === 'credit_card' && type === 'expense') {
    if (impactMonthStr && /^\d{4}-\d{2}$/.test(impactMonthStr)) {
      billingMonth = impactMonthStr;
    } else if (card) {
      billingMonth = calculateCardBillingMonth(date, card.closing_day, card.due_day);
    }
  }

  let installmentsTotal = 1;
  let startingInstallment = 1;

  if (pm.type === 'credit_card' && type === 'expense') {
    const parsedTotal = parseInstallment(installmentsTotalStr, 'La cantidad de cuotas');
    const parsedStart = parseInstallment(startingInstallmentStr, 'La cuota inicial');
    if (typeof parsedTotal === 'string') return { error: parsedTotal };
    if (typeof parsedStart === 'string') return { error: parsedStart };
    installmentsTotal = parsedTotal;
    startingInstallment = parsedStart;

    if (startingInstallment > installmentsTotal) {
      return { error: 'La cuota inicial no puede ser mayor al total de cuotas' };
    }
  }

  try {
    await db.transaction(async (tx) => {
      if (installmentsTotal === 1) {
        const [newTx] = await tx.insert(transactions).values({
          type,
          date,
          month: billingMonth,
          amount: amountCents,
          description,
          payer_person_id,
          payment_method_id,
          card_id: pm.card_id,
          status: 'active'
        }).returning({ id: transactions.id });

        const splitsToInsert = parsedSplits.map(s => ({
          transaction_id: newTx.id,
          person_id: s.person_id,
          amount: s.amount
        }));
        await tx.insert(transaction_splits).values(splitsToInsert);
      } else {
        const groupId = crypto.randomUUID();
        await tx.insert(installment_groups).values({
          id: groupId,
          description,
          total_amount: amountCents,
          installments_total: installmentsTotal,
          // billingMonth es el mes en que debe aparecer la primera cuota
          // que se está cargando, aunque no sea la cuota 1.
          start_month: billingMonth
        });

        for (let i = startingInstallment; i <= installmentsTotal; i++) {
          // Avanzamos desde la cuota inicial cargada, no desde la cuota 1.
          // Ej.: cuota 4/6 cargada para octubre => 4 en octubre, 5 en
          // noviembre y 6 en diciembre.
          const currentMonth = addMonths(billingMonth, i - startingInstallment);
          const [curYear, curMonth] = currentMonth.split('-').map(Number);
          const daysInMonth = new Date(curYear, curMonth, 0).getDate();
          const targetDay = card?.due_day || Number(date.split('-')[2]) || 1;
          const safeDay = Math.min(targetDay, daysInMonth);
          const installmentDate = `${currentMonth}-${String(safeDay).padStart(2, '0')}`;

          let transactionAmountThisMonth = 0;
          const splitsThisMonth: Array<{ person_id: string; amount: number }> = [];

          for (const split of parsedSplits) {
            const baseAmount = Math.floor(split.amount / installmentsTotal);
            const remainder = split.amount % installmentsTotal;
            let currentSplitAmount = baseAmount;
            if (i > installmentsTotal - remainder) {
              currentSplitAmount += 1;
            }
            splitsThisMonth.push({ person_id: split.person_id, amount: currentSplitAmount });
            transactionAmountThisMonth += currentSplitAmount;
          }

          const [newTx] = await tx.insert(transactions).values({
            type,
            date: installmentDate,
            month: currentMonth,
            amount: transactionAmountThisMonth,
            description: `${description} (Cuota ${i}/${installmentsTotal})`,
            payer_person_id,
            payment_method_id,
            card_id: pm.card_id,
            installment_group_id: groupId,
            status: 'active'
          }).returning({ id: transactions.id });

          const splitsToInsert = splitsThisMonth.map(s => ({
            transaction_id: newTx.id,
            person_id: s.person_id,
            amount: s.amount
          }));
          await tx.insert(transaction_splits).values(splitsToInsert);
        }
      }
    });
  } catch (e) {
    console.error(e);
    return { error: 'Error interno al guardar el movimiento y sus divisiones' };
  }

  revalidatePath('/');
  revalidatePath('/movimientos');
  revalidatePath('/movimientos/nuevo');
  return { success: true };
}
