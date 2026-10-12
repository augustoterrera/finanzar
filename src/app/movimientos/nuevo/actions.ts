'use server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/db';
import { revalidatePath } from 'next/cache';
import { persistTransaction, prepareTransaction } from '@/lib/transaction-write-service';

export async function createTransactionAction(prevState: any, formData: FormData) {
	const session = await requireAuth();
	const draft = {
		type: formData.get('type')?.toString(),
		date: formData.get('date')?.toString(),
		amount: formData.get('amount')?.toString(),
		description: formData.get('description')?.toString(),
		payerPersonId: formData.get('payer_person_id')?.toString(),
		paymentMethodId: formData.get('payment_method_id')?.toString(),
		splitsJson: formData.get('splits')?.toString(),
		installmentsTotal: formData.get('installments_total')?.toString(),
		startingInstallment: formData.get('starting_installment')?.toString(),
		impactMonth: formData.get('impact_month')?.toString(),
	};
	const prepared = await prepareTransaction(db, session.user.id, draft);
	if ('error' in prepared) return { error: prepared.error };

	try {
		await persistTransaction(db, session.user.id, prepared.input);
  } catch (e) {
    console.error(e);
    return { error: 'Error interno al guardar el movimiento y sus divisiones' };
  }

  revalidatePath('/');
  revalidatePath('/movimientos');
  revalidatePath('/movimientos/nuevo');
  return { success: true };
}
