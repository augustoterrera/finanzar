'use server';
import { requireAuth } from '@/lib/auth';

import { db } from '@/db';
import { recurring_rules, people, payment_methods, transactions, transaction_splits, cards } from '@/db/schema';
import { eq, and, isNotNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import crypto from 'node:crypto';

function parseMoneyToCents(value: string): number | null {
  const normalized = value.replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, decimal = ''] = normalized.split('.');
  const cents = Number(whole) * 100 + Number(decimal.padEnd(2, '0'));
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

function parseDay(value: string | undefined): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const day = Number(value);
  return Number.isInteger(day) && day >= 1 && day <= 31 ? day : null;
}

function isValidMonth(value: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(value)) return false;
  const [year, month] = value.split('-').map(Number);
  return Number.isInteger(year) && month >= 1 && month <= 12;
}

function dateForMonth(month: string, requestedDay: number): string {
  const [year, monthNumber] = month.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return `${month}-${String(Math.min(requestedDay, lastDay)).padStart(2, '0')}`;
}

export async function createRuleAction(prevState: any, formData: FormData) {
  await requireAuth();
  const type = formData.get('type')?.toString();
  const description = formData.get('description')?.toString()?.trim();
  const amountStr = formData.get('amount')?.toString();
  const day_of_month = parseDay(formData.get('day_of_month')?.toString());
  const payer_person_id = formData.get('payer_person_id')?.toString();
  const payment_method_id = formData.get('payment_method_id')?.toString();

  if (!type || !description || !amountStr || !payer_person_id || !payment_method_id) {
    return { error: 'Faltan campos obligatorios' };
  }
  if (type !== 'income' && type !== 'expense') {
    return { error: 'Tipo inválido' };
  }
  if (day_of_month === null) {
    return { error: 'El día del mes debe estar entre 1 y 31' };
  }
  
  const amountCents = parseMoneyToCents(amountStr);
  if (amountCents === null) {
    return { error: 'Monto inválido' };
  }

  const pm = await db.select().from(payment_methods).where(eq(payment_methods.id, payment_method_id)).get();
  const payer = await db.select().from(people).where(eq(people.id, payer_person_id)).get();
  
  if (!pm) return { error: 'Medio de pago no existe' };
  if (!payer) return { error: 'La persona responsable no existe' };
  if (pm.type === 'credit_card' && type !== 'expense') {
    return { error: 'Las tarjetas solo pueden usarse para egresos' };
  }
  if (pm.type === 'credit_card' && !pm.card_id) {
    return { error: 'El medio de pago de tarjeta no tiene una tarjeta asociada' };
  }

  try {
    await db.insert(recurring_rules).values({
      type,
      description,
      amount: amountCents,
      day_of_month,
      payer_person_id,
      payment_method_id,
      card_id: pm.card_id,
      active: true
    });
    revalidatePath('/recurrentes');
    return { success: true };
  } catch (e) {
    return { error: 'Error al crear la regla recurrente' };
  }
}

export async function toggleRuleAction(id: string, active: boolean) {
  await requireAuth();
  try {
    await db.update(recurring_rules).set({ active }).where(eq(recurring_rules.id, id));
    revalidatePath('/recurrentes');
    return { success: true };
  } catch (e) {
    return { error: 'Error al actualizar estado' };
  }
}

export async function generateRulesAction(prevState: any, formData: FormData) {
  await requireAuth();
  const month = formData.get('month')?.toString();
  
  if (!month || !isValidMonth(month)) {
    return { error: 'Mes inválido' };
  }

  try {
    const activeRules = await db.select().from(recurring_rules).where(eq(recurring_rules.active, true));
    if (activeRules.length === 0) {
      return { error: 'No hay reglas recurrentes activas' };
    }

    const existingTxs = await db
      .select({ rule_id: transactions.recurring_rule_id })
      .from(transactions)
      .where(and(eq(transactions.month, month), isNotNull(transactions.recurring_rule_id)));
    
    const generatedRuleIds = new Set(existingTxs.map(t => t.rule_id).filter(id => id !== null));
    const pendingRules = activeRules.filter(r => !generatedRuleIds.has(r.id));
    
    if (pendingRules.length === 0) {
      return { info: 'Todos los recurrentes de este mes ya fueron generados' };
    }

    let generatedCount = 0;
    await db.transaction(async (tx) => {
      for (const rule of pendingRules) {
        const txId = crypto.randomUUID();
        const dateStr = dateForMonth(month, rule.day_of_month);

        const [generatedTransaction] = await tx.insert(transactions).values({
          id: txId,
          date: dateStr,
          month: month,
          type: rule.type,
          amount: rule.amount,
          description: rule.description,
          payer_person_id: rule.payer_person_id,
          payment_method_id: rule.payment_method_id,
          card_id: rule.card_id,
          recurring_rule_id: rule.id,
          status: 'active'
        }).onConflictDoNothing().returning({ id: transactions.id });

        if (!generatedTransaction) continue;
        generatedCount += 1;

        await tx.insert(transaction_splits).values({
          transaction_id: generatedTransaction.id,
          person_id: rule.payer_person_id,
          amount: rule.amount
        });
      }
    });

    if (generatedCount === 0) {
      return { info: 'Todos los recurrentes de este mes ya fueron generados' };
    }

    revalidatePath('/recurrentes');
    return { success: `Se generaron ${generatedCount} gastos/ingresos para ${month}` };
  } catch (e) {
    return { error: 'Error al generar los recurrentes' };
  }
}
