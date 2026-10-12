import { eq, inArray } from 'drizzle-orm';
import type { db } from '@/db';
import { assertPrivateLedgerOwner } from '@/lib/expense-ledger-service';
import { cards, installment_groups, payment_methods, people, recurring_rules, transaction_splits, transactions } from '@/db/schema';

export async function getMcpTransaction(database: typeof db, ownerUserId: string, transactionId: string) {
	await assertPrivateLedgerOwner(database, ownerUserId);
	const [transaction] = await database.select().from(transactions).where(eq(transactions.id, transactionId)).limit(1);
	if (!transaction) return null;
	const [splits, [payer], [paymentMethod], [card], [group], allPeople] = await Promise.all([
		database.select().from(transaction_splits).where(eq(transaction_splits.transaction_id, transactionId)),
		database.select({ id: people.id, name: people.name }).from(people).where(eq(people.id, transaction.payer_person_id)).limit(1),
		database.select({ id: payment_methods.id, name: payment_methods.name, type: payment_methods.type }).from(payment_methods).where(eq(payment_methods.id, transaction.payment_method_id)).limit(1),
		transaction.card_id ? database.select({ id: cards.id, name: cards.name }).from(cards).where(eq(cards.id, transaction.card_id)).limit(1) : Promise.resolve([]),
		transaction.installment_group_id ? database.select().from(installment_groups).where(eq(installment_groups.id, transaction.installment_group_id)).limit(1) : Promise.resolve([]),
		database.select({ id: people.id, name: people.name }).from(people),
	]);
	const peopleById = new Map(allPeople.map((person) => [person.id, person.name]));
	return {
		id: transaction.id, type: transaction.type, date: transaction.date, impact_month: transaction.month,
		amount_cents: transaction.amount, description: transaction.description, status: transaction.status,
		payer: payer ?? null, payment_method: paymentMethod ?? null, card: card ?? null,
		responsibilities: splits.map((split) => ({ person_id: split.person_id, person: peopleById.get(split.person_id) ?? 'Persona no encontrada', amount_cents: split.amount })),
		installment_group: group ? { id: group.id, purchase_total_cents: group.total_amount, installments_total: group.installments_total, start_month: group.start_month } : null,
	};
}

export async function getMcpInstallmentGroup(database: typeof db, ownerUserId: string, groupId: string) {
	await assertPrivateLedgerOwner(database, ownerUserId);
	const [group] = await database.select().from(installment_groups).where(eq(installment_groups.id, groupId)).limit(1);
	if (!group) return null;
	const installments = await database.select().from(transactions).where(eq(transactions.installment_group_id, groupId));
	installments.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
	const installmentIds = installments.map((item) => item.id);
	const [allSplits, allPeople] = installmentIds.length
		? await Promise.all([
			database.select().from(transaction_splits).where(inArray(transaction_splits.transaction_id, installmentIds)),
			database.select({ id: people.id, name: people.name }).from(people),
		])
		: [[], await database.select({ id: people.id, name: people.name }).from(people)];
	const peopleById = new Map(allPeople.map((person) => [person.id, person.name]));
	const splitsByTransaction = new Map<string, typeof allSplits>();
	for (const split of allSplits) {
		const rows = splitsByTransaction.get(split.transaction_id) ?? [];
		rows.push(split);
		splitsByTransaction.set(split.transaction_id, rows);
	}
	return {
		id: group.id, description: group.description, purchase_total_cents: group.total_amount,
		installments_total: group.installments_total, start_month: group.start_month,
		registered_installments: installments.length,
		installments: installments.map((item) => ({
			transaction_id: item.id, date: item.date, month: item.month, amount_cents: item.amount,
			description: item.description, status: item.status,
			responsibilities: (splitsByTransaction.get(item.id) ?? []).map((split) => ({
				person_id: split.person_id, person: peopleById.get(split.person_id) ?? 'Persona no encontrada', amount_cents: split.amount,
			})),
		})),
	};
}

export async function listMcpRecurringRules(database: typeof db, ownerUserId: string, options: { activeOnly: boolean; limit: number }) {
	await assertPrivateLedgerOwner(database, ownerUserId);
	const [rules, allPeople, allCards, allPaymentMethods] = await Promise.all([
		database.select().from(recurring_rules),
		database.select({ id: people.id, name: people.name }).from(people),
		database.select({ id: cards.id, name: cards.name }).from(cards),
		database.select({ id: payment_methods.id, name: payment_methods.name }).from(payment_methods),
	]);
	const peopleById = new Map(allPeople.map((person) => [person.id, person.name]));
	const cardsById = new Map(allCards.map((card) => [card.id, card.name]));
	const methodsById = new Map(allPaymentMethods.map((method) => [method.id, method.name]));
	const matched = rules.filter((rule) => !options.activeOnly || rule.active).sort((a, b) => a.description.localeCompare(b.description));
	return {
		currency: 'ARS', unit: 'centavos', total_matching_records: matched.length, truncated: matched.length > options.limit,
		rules: matched.slice(0, options.limit).map((rule) => ({
			id: rule.id, description: rule.description, type: rule.type, amount_cents: rule.amount,
			frequency: rule.frequency, day_of_month: rule.day_of_month, active: rule.active,
			payer: { id: rule.payer_person_id, name: peopleById.get(rule.payer_person_id) ?? 'Persona no encontrada' },
			payment_method: { id: rule.payment_method_id, name: methodsById.get(rule.payment_method_id) ?? 'Medio de pago no encontrado' },
			card: rule.card_id ? { id: rule.card_id, name: cardsById.get(rule.card_id) ?? 'Tarjeta no encontrada' } : null,
		})),
	};
}
