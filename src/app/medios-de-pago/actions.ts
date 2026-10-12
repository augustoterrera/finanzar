'use server';

import { db } from '@/db';
import { cards, payment_methods, people, recurring_rules, transactions } from '@/db/schema';
import { requireAuth } from '@/lib/auth';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

type ActionState = { success?: boolean; error?: string };
type MethodType = 'cash' | 'debit' | 'transfer' | 'credit_card';

function methodType(value: FormDataEntryValue | null): MethodType | null {
  return value === 'cash' || value === 'debit' || value === 'transfer' || value === 'credit_card' ? value : null;
}

function day(value: FormDataEntryValue | null): number | null | undefined {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 31 ? parsed : undefined;
}

function color(value: FormDataEntryValue | null): string | null | undefined {
  if (!value) return null;
  const parsed = value.toString();
  return /^#[\da-f]{6}$/i.test(parsed) ? parsed : undefined;
}

function refreshPaymentMethods() {
  revalidatePath('/medios-de-pago');
  revalidatePath('/tarjetas');
  revalidatePath('/movimientos/nuevo');
  revalidatePath('/recurrentes');
}

export async function createPaymentMethodAction(_state: ActionState | null, formData: FormData): Promise<ActionState> {
  await requireAuth();
  const type = methodType(formData.get('type'));
  const name = formData.get('name')?.toString().trim();
  const methodColor = color(formData.get('color'));
  if (!name || !type || methodColor === undefined) return { error: 'Revisá el nombre, el tipo y el color.' };

  if (type === 'credit_card') {
    const ownerId = formData.get('owner_person_id')?.toString();
    const closingDay = day(formData.get('closing_day'));
    const dueDay = day(formData.get('due_day'));
    if (!ownerId || closingDay === undefined || dueDay === undefined) {
      return { error: 'Elegí el titular y revisá los días de cierre y vencimiento (1 a 31).' };
    }
    const owner = await db.select({ id: people.id }).from(people).where(eq(people.id, ownerId)).get();
    if (!owner) return { error: 'El titular seleccionado no existe.' };

    try {
      await db.transaction(async (tx) => {
        const cardId = crypto.randomUUID();
        await tx.insert(cards).values({ id: cardId, name, owner_person_id: ownerId, color: methodColor, closing_day: closingDay, due_day: dueDay });
        await tx.insert(payment_methods).values({ name, type, card_id: cardId, color: methodColor });
      });
    } catch {
      return { error: 'No se pudo crear la tarjeta. No se guardó ningún dato parcial.' };
    }
  } else {
    try {
      await db.insert(payment_methods).values({ name, type, color: methodColor });
    } catch {
      return { error: 'No se pudo crear el medio de pago.' };
    }
  }
  refreshPaymentMethods();
  return { success: true };
}

// Tarjetas creadas con el flujo anterior: se pueden activar sin volver a cargarlas.
export async function activateCardAction(_state: ActionState | null, formData: FormData): Promise<ActionState> {
  await requireAuth();
  const cardId = formData.get('card_id')?.toString();
  if (!cardId) return { error: 'Falta la tarjeta.' };
  try {
    await db.transaction(async (tx) => {
      const card = await tx.select().from(cards).where(eq(cards.id, cardId)).get();
      if (!card) throw new Error('missing');
      const existing = await tx.select({ id: payment_methods.id }).from(payment_methods).where(eq(payment_methods.card_id, cardId)).get();
      if (existing) throw new Error('linked');
      await tx.insert(payment_methods).values({ name: card.name, type: 'credit_card', card_id: card.id, color: card.color });
    });
  } catch {
    return { error: 'No se pudo activar la tarjeta. Actualizá la página y comprobá si ya está disponible.' };
  }
  refreshPaymentMethods();
  return { success: true };
}

export async function updatePaymentMethodAction(_state: ActionState | null, formData: FormData): Promise<ActionState> {
  await requireAuth();
  const id = formData.get('id')?.toString();
  const name = formData.get('name')?.toString().trim();
  const type = methodType(formData.get('type'));
  const methodColor = color(formData.get('color'));
  if (!id || !name || !type || methodColor === undefined) return { error: 'Revisá los datos del medio de pago.' };

  const existing = await db.select().from(payment_methods).where(eq(payment_methods.id, id)).get();
  if (!existing) return { error: 'El medio de pago ya no existe.' };
  if ((existing.type === 'credit_card') !== (type === 'credit_card')) {
    return { error: 'No se puede convertir una tarjeta en otro medio ni al revés. Creá uno nuevo.' };
  }

  if (existing.card_id) {
    const ownerId = formData.get('owner_person_id')?.toString();
    const closingDay = day(formData.get('closing_day'));
    const dueDay = day(formData.get('due_day'));
    if (!ownerId || closingDay === undefined || dueDay === undefined) {
      return { error: 'Elegí el titular y revisá los días de cierre y vencimiento (1 a 31).' };
    }
    const owner = await db.select({ id: people.id }).from(people).where(eq(people.id, ownerId)).get();
    if (!owner) return { error: 'El titular seleccionado no existe.' };
    try {
      await db.transaction(async (tx) => {
        await tx.update(cards).set({ name, owner_person_id: ownerId, closing_day: closingDay, due_day: dueDay, color: methodColor }).where(eq(cards.id, existing.card_id!));
        await tx.update(payment_methods).set({ name, color: methodColor }).where(eq(payment_methods.id, id));
      });
    } catch {
      return { error: 'No se pudo actualizar la tarjeta.' };
    }
  } else {
    try {
      await db.update(payment_methods).set({ name, type, color: methodColor }).where(eq(payment_methods.id, id));
    } catch {
      return { error: 'No se pudo actualizar el medio de pago.' };
    }
  }
  refreshPaymentMethods();
  return { success: true };
}

export async function deletePaymentMethodAction(_state: ActionState | null, formData: FormData): Promise<ActionState> {
  await requireAuth();
  const id = formData.get('id')?.toString();
  if (!id) return { error: 'Falta el medio de pago.' };
  try {
    await db.transaction(async (tx) => {
      const method = await tx.select().from(payment_methods).where(eq(payment_methods.id, id)).get();
      if (!method) throw new Error('missing');
      if (await tx.select({ id: transactions.id }).from(transactions).where(eq(transactions.payment_method_id, id)).get()) throw new Error('used');
      if (await tx.select({ id: recurring_rules.id }).from(recurring_rules).where(eq(recurring_rules.payment_method_id, id)).get()) throw new Error('used');
      if (method.card_id) {
        if (await tx.select({ id: transactions.id }).from(transactions).where(eq(transactions.card_id, method.card_id)).get()) throw new Error('used');
        if (await tx.select({ id: recurring_rules.id }).from(recurring_rules).where(eq(recurring_rules.card_id, method.card_id)).get()) throw new Error('used');
      }
      await tx.delete(payment_methods).where(eq(payment_methods.id, id));
      if (method.card_id) {
        const otherLink = await tx.select({ id: payment_methods.id }).from(payment_methods).where(eq(payment_methods.card_id, method.card_id)).get();
        if (!otherLink) await tx.delete(cards).where(eq(cards.id, method.card_id));
      }
    });
  } catch {
    return { error: 'No se puede eliminar si tiene movimientos o reglas recurrentes. Si no se usa, actualizá la página e intentá de nuevo.' };
  }
  refreshPaymentMethods();
  return { success: true };
}
