'use server';
import { requireAuth } from '@/lib/auth';

import { db } from '@/db';
import { payment_methods, cards, transactions, recurring_rules } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

function isPaymentMethodType(value: string | undefined): value is 'cash' | 'debit' | 'transfer' | 'credit_card' {
  return value === 'cash' || value === 'debit' || value === 'transfer' || value === 'credit_card';
}

export async function createPaymentMethodAction(prevState: any, formData: FormData) {
  await requireAuth();
  const mode = formData.get('mode')?.toString();
  const card_id = formData.get('card_id')?.toString() || null;
  let name = formData.get('name')?.toString().trim();
  let type = formData.get('type')?.toString();
  let color = formData.get('color')?.toString().trim() || null;

  // Si el modo es vincular tarjeta o viene card_id sin especificar tipo manual
  if (mode === 'card' || (card_id && !type)) {
    if (!card_id) {
      return { error: 'Debe seleccionar una tarjeta' };
    }
    const card = await db.select().from(cards).where(eq(cards.id, card_id)).get();
    if (!card) {
      return { error: 'La tarjeta seleccionada no existe' };
    }

    const existing = await db.select().from(payment_methods).where(eq(payment_methods.card_id, card_id)).get();
    if (existing) {
      return { error: `La tarjeta "${card.name}" ya está vinculada al medio de pago "${existing.name}"` };
    }

    name = card.name;
    type = 'credit_card';
    if (!color && card.color) {
      color = card.color;
    }
  } else {
    // Modo manual / otros medios de pago
    if (!name || !type) {
      return { error: 'Nombre y tipo son obligatorios' };
    }

    if (!isPaymentMethodType(type)) {
      return { error: 'Tipo de medio de pago inválido' };
    }

    if (type === 'credit_card') {
      if (!card_id) {
        return { error: 'Debe seleccionar una tarjeta para el tipo Tarjeta de Crédito' };
      }
      const card = await db.select().from(cards).where(eq(cards.id, card_id)).get();
      if (!card) {
        return { error: 'La tarjeta seleccionada no existe' };
      }
      if (!color && card.color) {
        color = card.color;
      }
    }
  }

  try {
    await db.insert(payment_methods).values({ 
      name: name!, 
      type: type as 'cash' | 'debit' | 'transfer' | 'credit_card',
      card_id: type === 'credit_card' ? card_id : null,
      color: color || null
    });
    revalidatePath('/medios-de-pago');
    return { success: true };
  } catch (e) {
    return { error: 'Error al crear medio de pago' };
  }
}

export async function updatePaymentMethodAction(prevState: any, formData: FormData) {
  await requireAuth();
  const id = formData.get('id')?.toString();
  let name = formData.get('name')?.toString().trim();
  const type = formData.get('type')?.toString();
  let card_id = formData.get('card_id')?.toString() || null;
  let color = formData.get('color')?.toString().trim() || null;

  if (!id || !type || !isPaymentMethodType(type)) {
    return { error: 'Datos de medio de pago inválidos' };
  }

  const method = await db.select().from(payment_methods).where(eq(payment_methods.id, id)).get();
  if (!method) return { error: 'Medio de pago no encontrado' };

  if (type === 'credit_card') {
    if (!card_id) return { error: 'Debe seleccionar una tarjeta para el tipo Tarjeta de Crédito' };
    const card = await db.select().from(cards).where(eq(cards.id, card_id)).get();
    if (!card) return { error: 'La tarjeta seleccionada no existe' };
    if (!name) name = card.name;
    if (!color && card.color) color = card.color;
  } else {
    if (!name) return { error: 'El nombre es obligatorio' };
    card_id = null;
  }

  try {
    await db.update(payment_methods).set({ 
      name: name!, 
      type, 
      card_id, 
      color: color || null 
    }).where(eq(payment_methods.id, id));
    revalidatePath('/medios-de-pago');
    return { success: true };
  } catch {
    return { error: 'Error al actualizar medio de pago' };
  }
}

export async function deletePaymentMethodAction(prevState: any, formData: FormData) {
  await requireAuth();
  const id = formData.get('id')?.toString();

  if (!id) return { error: 'ID de medio de pago no provisto' };
  const method = await db.select().from(payment_methods).where(eq(payment_methods.id, id)).get();
  if (!method) return { error: 'Medio de pago no encontrado' };

  const hasTransactions = await db.select().from(transactions).where(eq(transactions.payment_method_id, id)).get();
  if (hasTransactions) return { error: 'El medio de pago tiene movimientos registrados' };

  const hasRules = await db.select().from(recurring_rules).where(eq(recurring_rules.payment_method_id, id)).get();
  if (hasRules) return { error: 'El medio de pago se usa en una regla recurrente' };

  try {
    await db.delete(payment_methods).where(eq(payment_methods.id, id));
    revalidatePath('/medios-de-pago');
    return { success: true };
  } catch (e) {
    return { error: 'Error inesperado al borrar' };
  }
}
