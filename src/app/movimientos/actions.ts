'use server';

import { db } from '@/db';
import { transactions, transaction_splits, installment_groups } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function deleteTransactionAction(transactionId: string) {
  const { requireAuth } = await import('@/lib/auth');
  await requireAuth();

  if (!transactionId) {
    throw new Error('ID de transacción inválido');
  }

  const tx = await db.select().from(transactions).where(eq(transactions.id, transactionId)).get();
  if (!tx) return { success: true };

  if (tx.recurring_rule_id) {
    // Si es un recurrente, hacemos soft delete ('void') para que el uniqueIndex evite
    // que el motor lo vuelva a generar si alguien aprieta "Generar" nuevamente este mes.
    await db.update(transactions).set({ status: 'void' }).where(eq(transactions.id, transactionId));
    // Borramos los splits para mantener limpia la info, la transacción queda como ghost.
    await db.delete(transaction_splits).where(eq(transaction_splits.transaction_id, transactionId));
  } else if (tx.installment_group_id) {
    // Si es una cuota, eliminamos todas las cuotas asociadas al grupo
    const groupTxs = await db
      .select({ id: transactions.id })
      .from(transactions)
      .where(eq(transactions.installment_group_id, tx.installment_group_id));
    
    const ids = groupTxs.map(t => t.id);
    if (ids.length > 0) {
      await db.delete(transaction_splits).where(inArray(transaction_splits.transaction_id, ids));
      await db.delete(transactions).where(eq(transactions.installment_group_id, tx.installment_group_id));
      await db.delete(installment_groups).where(eq(installment_groups.id, tx.installment_group_id));
    }
  } else {
    // Borramos primero los splits asociados
    await db.delete(transaction_splits).where(eq(transaction_splits.transaction_id, transactionId));
    // Borramos la transacción
    await db.delete(transactions).where(eq(transactions.id, transactionId));
  }

  revalidatePath('/');
  revalidatePath('/movimientos');

  return { success: true };
}
