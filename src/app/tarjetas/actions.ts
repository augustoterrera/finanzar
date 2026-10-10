'use server';
import { requireAuth } from '@/lib/auth';

import { db } from '@/db';
import { cards, people, payment_methods, transactions, recurring_rules } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

function parseDay(value: string | undefined, label: string): number | null | string {
  if (!value) return null;
  const day = Number(value);
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    return `${label} debe ser un número entero entre 1 y 31`;
  }
  return day;
}

export async function createCardAction(prevState: any, formData: FormData) {
  await requireAuth();
  const name = formData.get('name')?.toString().trim();
  const owner_person_id = formData.get('owner_person_id')?.toString();
  const closing_day_str = formData.get('closing_day')?.toString();
  const due_day_str = formData.get('due_day')?.toString();
  const color = formData.get('color')?.toString() || null;

  if (!name || !owner_person_id) {
    return { error: 'Nombre y dueño son obligatorios' };
  }

  const closing_day = parseDay(closing_day_str, 'Día de cierre');
  if (typeof closing_day === 'string') return { error: closing_day };

  const due_day = parseDay(due_day_str, 'Día de vencimiento');
  if (typeof due_day === 'string') return { error: due_day };

  const person = await db.select().from(people).where(eq(people.id, owner_person_id)).get();
  if (!person) {
    return { error: 'El dueño seleccionado no existe' };
  }

  try {
    await db.insert(cards).values({ 
      name, 
      owner_person_id, 
      color,
      closing_day, 
      due_day 
    });
    revalidatePath('/tarjetas');
    revalidatePath('/medios-de-pago');
    return { success: true };
  } catch (e) {
    return { error: 'Error al crear tarjeta' };
  }
}

export async function updateCardAction(prevState: any, formData: FormData) {
  await requireAuth();
  const id = formData.get('id')?.toString();
  const name = formData.get('name')?.toString().trim();
  const owner_person_id = formData.get('owner_person_id')?.toString();
  const closing_day = parseDay(formData.get('closing_day')?.toString(), 'Día de cierre');
  const due_day = parseDay(formData.get('due_day')?.toString(), 'Día de vencimiento');
  const color = formData.get('color')?.toString() || null;

  if (!id || !name || !owner_person_id) {
    return { error: 'Nombre y dueño son obligatorios' };
  }
  if (typeof closing_day === 'string') return { error: closing_day };
  if (typeof due_day === 'string') return { error: due_day };

  const card = await db.select().from(cards).where(eq(cards.id, id)).get();
  const person = await db.select().from(people).where(eq(people.id, owner_person_id)).get();
  
  if (!card) return { error: 'Tarjeta no encontrada' };
  if (!person) return { error: 'El dueño seleccionado no existe' };

  try {
    await db
      .update(cards)
      .set({ name, owner_person_id, color, closing_day, due_day })
      .where(eq(cards.id, id));
    revalidatePath('/tarjetas');
    revalidatePath('/medios-de-pago');
    return { success: true };
  } catch {
    return { error: 'Error al actualizar tarjeta' };
  }
}

export async function deleteCardAction(prevState: any, formData: FormData) {
  await requireAuth();
  const id = formData.get('id')?.toString();

  if (!id) return { error: 'ID de tarjeta no provisto' };
  const card = await db.select().from(cards).where(eq(cards.id, id)).get();
  if (!card) return { error: 'Tarjeta no encontrada' };

  const hasPaymentMethods = await db.select().from(payment_methods).where(eq(payment_methods.card_id, id)).get();
  if (hasPaymentMethods) return { error: 'La tarjeta está asociada a un medio de pago' };

  const hasTransactions = await db.select().from(transactions).where(eq(transactions.card_id, id)).get();
  if (hasTransactions) return { error: 'La tarjeta tiene movimientos registrados' };

  const hasRules = await db.select().from(recurring_rules).where(eq(recurring_rules.card_id, id)).get();
  if (hasRules) return { error: 'La tarjeta se usa en una regla recurrente' };

  try {
    await db.delete(cards).where(eq(cards.id, id));
    revalidatePath('/tarjetas');
    revalidatePath('/medios-de-pago');
    return { success: true };
  } catch (e) {
    return { error: 'Error inesperado al borrar' };
  }
}
