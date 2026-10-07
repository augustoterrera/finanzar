'use server';
import { requireAuth } from '@/lib/auth';

import { db } from '@/db';
import { people, transactions, transaction_splits, cards, recurring_rules } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function createPersonAction(prevState: any, formData: FormData) {
  await requireAuth();
  const name = formData.get('name')?.toString().trim();

  if (!name) {
    return { error: 'El nombre es obligatorio' };
  }

  try {
    await db.insert(people).values({ name });
    revalidatePath('/personas');
    return { success: true };
  } catch (e) {
    return { error: 'Error al crear persona' };
  }
}

export async function updatePersonAction(prevState: any, formData: FormData) {
  await requireAuth();
  const id = formData.get('id')?.toString();
  const name = formData.get('name')?.toString().trim();

  if (!id || !name) {
    return { error: 'El nombre es obligatorio' };
  }

  const person = await db.select().from(people).where(eq(people.id, id)).get();
  if (!person) {
    return { error: 'Persona no encontrada' };
  }

  try {
    await db.update(people).set({ name }).where(eq(people.id, id));
    revalidatePath('/personas');
    return { success: true };
  } catch {
    return { error: 'Error al actualizar persona' };
  }
}

export async function deletePersonAction(prevState: any, formData: FormData) {
  await requireAuth();
  const id = formData.get('id')?.toString();

  if (!id) {
    return { error: 'ID de persona no provisto' };
  }

  const person = await db.select().from(people).where(eq(people.id, id)).get();
  if (!person) {
    return { error: 'Persona no encontrada' };
  }
  if (person.is_owner) {
    return { error: 'No se puede eliminar al usuario owner' };
  }

  const hasTransactions = await db.select().from(transactions).where(eq(transactions.payer_person_id, id)).get();
  if (hasTransactions) return { error: 'La persona tiene movimientos donde pagó' };

  const hasSplits = await db.select().from(transaction_splits).where(eq(transaction_splits.person_id, id)).get();
  if (hasSplits) return { error: 'La persona es responsable de un gasto dividido (split)' };

  const hasCards = await db.select().from(cards).where(eq(cards.owner_person_id, id)).get();
  if (hasCards) return { error: 'La persona es dueña de una tarjeta' };

  const hasRules = await db.select().from(recurring_rules).where(eq(recurring_rules.payer_person_id, id)).get();
  if (hasRules) return { error: 'La persona es pagadora en un gasto recurrente' };

  try {
    await db.delete(people).where(eq(people.id, id));
    revalidatePath('/personas');
    return { success: true };
  } catch (e) {
    return { error: 'Error inesperado al borrar' };
  }
}
