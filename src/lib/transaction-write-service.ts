import { eq, inArray } from 'drizzle-orm';
import type { db } from '@/db';
import { cards, installment_groups, ledger_accounts, payment_methods, people, transaction_splits, transactions } from '@/db/schema';
import { assertPrivateLedgerOwner } from '@/lib/expense-ledger-service';
import { calculateCardBillingMonth } from '@/lib/card-billing';
import type { ScheduledInstallment, TransactionSplitInput } from '@/lib/transaction-domain';
import { buildInstallmentSchedule, isValidISODate, isValidYearMonth, parseMoneyToCents, parseSplitToCents } from '@/lib/transaction-domain';

export type TransactionDraft = {
	type?: string;
	date?: string;
	amount?: string;
	description?: string;
	payerPersonId?: string;
	paymentMethodId?: string;
	splitsJson?: string;
	installmentsTotal?: string;
	startingInstallment?: string;
	impactMonth?: string;
};

export type CreateTransactionInput = {
	type: 'income' | 'expense';
	date: string;
	billingMonth: string;
	amountCents: number;
	description: string;
	payerPersonId: string;
	paymentMethodId: string;
	cardId: string | null;
	installmentsTotal: number;
	splits: Array<{ person_id: string; amount: number }>;
	schedule: ScheduledInstallment[];
};

export type PreparationResult = { input: CreateTransactionInput } | { error: string };
export type FinanzarTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

function parseInstallment(value: string | undefined, label: string): number | string {
	if (!value) return 1;
	if (!/^\d+$/.test(value)) return `${label} debe ser un número entero entre 1 y 120`;
	const installment = Number(value);
	return installment >= 1 && installment <= 120 ? installment : `${label} debe ser un número entero entre 1 y 120`;
}

/** Shared validation/resolution boundary for web and future authorized MCP writes. */
export async function prepareTransaction(
	database: typeof db,
	ownerUserId: string,
	draft: TransactionDraft,
): Promise<PreparationResult> {
	await assertPrivateLedgerOwner(database, ownerUserId);
	const type = draft.type;
	const date = draft.date;
	const description = draft.description?.trim();
	const payerPersonId = draft.payerPersonId;
	const paymentMethodId = draft.paymentMethodId;
	const impactMonth = draft.impactMonth?.trim();
	if (!type || !date || !draft.amount || !description || !payerPersonId || !paymentMethodId || !draft.splitsJson) {
		return { error: 'Faltan campos obligatorios' };
	}
	if (type !== 'income' && type !== 'expense') return { error: 'Tipo de movimiento inválido' };
	if (!isValidISODate(date)) return { error: 'La fecha debe ser válida y tener formato AAAA-MM-DD' };
	const amountCents = parseMoneyToCents(draft.amount);
	if (amountCents === null) return { error: 'El monto debe ser positivo y tener como máximo dos decimales' };

	let splits: unknown;
	try { splits = JSON.parse(draft.splitsJson); } catch { return { error: 'Formato de splits inválido' }; }
	if (!Array.isArray(splits) || splits.length === 0) return { error: 'Se requiere al menos un responsable (split)' };
	const parsedSplits: TransactionSplitInput[] = [];
	for (const split of splits) {
		if (!split || typeof split !== 'object' || !('person_id' in split) || typeof split.person_id !== 'string' || !split.person_id || !('amount' in split)) {
			return { error: 'Datos de split incompletos' };
		}
		const splitAmountCents = parseSplitToCents(split.amount);
		if (splitAmountCents === null) return { error: 'Cada split debe ser un monto no negativo con máximo dos decimales' };
		parsedSplits.push({ person_id: split.person_id, amount: splitAmountCents });
	}
	const splitPersonIds = parsedSplits.map((split) => split.person_id);
	const splitTotal = parsedSplits.reduce((sum, split) => sum + split.amount, 0);
	if (splitTotal !== amountCents) {
		return { error: `La suma de las divisiones ($${(splitTotal / 100).toFixed(2)}) no coincide con el total ($${(amountCents / 100).toFixed(2)})` };
	}
	if (new Set(splitPersonIds).size !== splitPersonIds.length) return { error: 'Cada persona puede aparecer una sola vez en las divisiones' };

	const [pm] = await database.select().from(payment_methods).where(eq(payment_methods.id, paymentMethodId)).limit(1);
	const [payer] = await database.select().from(people).where(eq(people.id, payerPersonId)).limit(1);
	const splitPeople = await database.select({ id: people.id }).from(people).where(inArray(people.id, splitPersonIds));
	if (!pm) return { error: 'Medio de pago no encontrado' };
	if (!payer) return { error: 'La persona que paga no existe' };
	if (splitPeople.length !== splitPersonIds.length) return { error: 'Una o más personas de las divisiones no existen' };
	if (pm.type === 'credit_card' && type !== 'expense') return { error: 'Las tarjetas solo pueden usarse para egresos' };
	if (pm.type === 'credit_card' && !pm.card_id) return { error: 'El medio de pago de tarjeta no tiene una tarjeta asociada' };
	if (pm.type !== 'credit_card' && pm.card_id) return { error: 'Un medio de pago que no es tarjeta no puede tener una tarjeta asociada' };

	let card: typeof cards.$inferSelect | undefined;
	if (pm.type === 'credit_card' && pm.card_id) {
		[card] = await database.select().from(cards).where(eq(cards.id, pm.card_id)).limit(1);
		if (!card) return { error: 'La tarjeta asociada al medio de pago no existe' };
	}
	let billingMonth = date.slice(0, 7);
	if (pm.type === 'credit_card' && type === 'expense') {
		if (impactMonth && !isValidYearMonth(impactMonth)) return { error: 'El mes de impacto debe ser válido y tener formato AAAA-MM' };
		billingMonth = impactMonth || (card ? calculateCardBillingMonth(date, card.closing_day, card.due_day) : billingMonth);
	}

	let installmentsTotal = 1;
	let startingInstallment = 1;
	if (pm.type === 'credit_card' && type === 'expense') {
		const parsedTotal = parseInstallment(draft.installmentsTotal, 'La cantidad de cuotas');
		const parsedStart = parseInstallment(draft.startingInstallment, 'La cuota inicial');
		if (typeof parsedTotal === 'string') return { error: parsedTotal };
		if (typeof parsedStart === 'string') return { error: parsedStart };
		installmentsTotal = parsedTotal;
		startingInstallment = parsedStart;
		if (startingInstallment > installmentsTotal) return { error: 'La cuota inicial no puede ser mayor al total de cuotas' };
	}
	let schedule: ScheduledInstallment[] = [];
	if (installmentsTotal > 1) {
		try {
			schedule = buildInstallmentSchedule({
				splits: parsedSplits, installmentsTotal, startingInstallment, billingMonth,
				dateDay: Number(date.split('-')[2]), dueDay: card?.due_day,
			});
		} catch (error) { return { error: error instanceof Error ? error.message : 'No se pudo calcular el calendario de cuotas' }; }
	}
	return { input: {
		type, date, billingMonth, amountCents, description, payerPersonId, paymentMethodId,
		cardId: pm.card_id, installmentsTotal, splits: parsedSplits, schedule,
	} };
}

/**
 * Persist a previously normalized movement and all of its splits atomically.
 * Web actions and future MCP proposals must use this boundary. The owner is
 * checked again here so a prepared object cannot bypass the private-ledger guard.
 */
function validatePreparedTransaction(input: CreateTransactionInput) {
	if (!input.description.trim() || !input.payerPersonId || !input.paymentMethodId) throw new Error('Faltan datos obligatorios del movimiento.');
	if (!isValidISODate(input.date) || !isValidYearMonth(input.billingMonth)) throw new Error('La fecha o el mes de impacto no son válidos.');
	if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) throw new Error('El importe debe ser positivo y estar expresado en centavos enteros.');
	if (!input.splits.length || input.splits.some((split) => !split.person_id || !Number.isSafeInteger(split.amount) || split.amount < 0)) {
		throw new Error('Las divisiones del movimiento no son válidas.');
	}
	if (new Set(input.splits.map((split) => split.person_id)).size !== input.splits.length
		|| input.splits.reduce((sum, split) => sum + split.amount, 0) !== input.amountCents) {
		throw new Error('Las divisiones deben ser únicas y sumar el importe total.');
	}
	if (!Number.isInteger(input.installmentsTotal) || input.installmentsTotal < 1 || input.installmentsTotal > 120) {
		throw new Error('La cantidad de cuotas debe ser un entero entre 1 y 120.');
	}
	if (input.installmentsTotal === 1 && input.schedule.length !== 0) throw new Error('Un movimiento de una cuota no debe incluir un calendario.');
	if (input.installmentsTotal > 1 && input.schedule.length === 0) throw new Error('Falta el calendario de cuotas.');
	if (input.schedule.some((installment, index) => {
		const expectedNumber = input.schedule[0].installmentNumber + index;
		return installment.installmentNumber !== expectedNumber
			|| installment.installmentNumber > input.installmentsTotal
			|| !isValidISODate(installment.date)
			|| !isValidYearMonth(installment.month)
			|| installment.date.slice(0, 7) !== installment.month
			|| !Number.isSafeInteger(installment.amount)
			|| installment.amount <= 0
			|| installment.splits.reduce((sum, split) => sum + split.amount, 0) !== installment.amount;
	})) throw new Error('El calendario de cuotas no es válido.');
	return input;
	}

export async function persistTransactionInTransaction(
	tx: FinanzarTransaction,
	ownerUserId: string,
	unvalidatedInput: CreateTransactionInput,
) {
	const input = validatePreparedTransaction(unvalidatedInput);
	const [ledgerOwner] = await tx.select({ id: ledger_accounts.id }).from(ledger_accounts)
		.where(eq(ledger_accounts.owner_user_id, ownerUserId)).limit(1);
	if (!ledgerOwner || ledgerOwner.id !== 'private') throw new Error('El usuario no es titular del libro financiero');
	const transactionIds: string[] = [];
	let installmentGroupId: string | null = null;
	if (input.installmentsTotal === 1) {
		const [newTransaction] = await tx.insert(transactions).values({
			type: input.type,
			date: input.date,
			month: input.billingMonth,
			amount: input.amountCents,
			description: input.description,
			payer_person_id: input.payerPersonId,
			payment_method_id: input.paymentMethodId,
			card_id: input.cardId,
			status: 'active',
		}).returning({ id: transactions.id });
		transactionIds.push(newTransaction.id);
		await tx.insert(transaction_splits).values(input.splits.map((split) => ({
			transaction_id: newTransaction.id,
			person_id: split.person_id,
			amount: split.amount,
		})));
	} else {
		installmentGroupId = crypto.randomUUID();
		await tx.insert(installment_groups).values({
			id: installmentGroupId,
			description: input.description,
			total_amount: input.amountCents,
			installments_total: input.installmentsTotal,
			start_month: input.billingMonth,
		});
		for (const installment of input.schedule) {
			const [newTransaction] = await tx.insert(transactions).values({
				type: input.type,
				date: installment.date,
				month: installment.month,
				amount: installment.amount,
				description: `${input.description} (Cuota ${installment.installmentNumber}/${input.installmentsTotal})`,
				payer_person_id: input.payerPersonId,
				payment_method_id: input.paymentMethodId,
				card_id: input.cardId,
				installment_group_id: installmentGroupId,
				status: 'active',
			}).returning({ id: transactions.id });
			transactionIds.push(newTransaction.id);
			await tx.insert(transaction_splits).values(installment.splits.map((split) => ({
				transaction_id: newTransaction.id,
				person_id: split.person_id,
				amount: split.amount,
			})));
		}
	}
	return { transactionIds, installmentGroupId };
}

export async function persistTransaction(
	database: typeof db,
	ownerUserId: string,
	input: CreateTransactionInput,
) {
	await assertPrivateLedgerOwner(database, ownerUserId);
	validatePreparedTransaction(input);
	return database.transaction((tx) => persistTransactionInTransaction(tx, ownerUserId, input));
}
