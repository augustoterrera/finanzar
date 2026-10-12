import { and, eq, ne } from 'drizzle-orm';
import { client, db } from '../src/db';
import {
	cards,
	installment_groups,
	ledger_accounts,
	payment_methods,
	people,
	recurring_rules,
	transaction_splits,
	transactions,
} from '../src/db/schema';
import { user } from '../src/db/auth-schema';

const localUrl = 'http://127.0.0.1:8080';
const demoNote = 'Dato ficticio de demostración local';
const pesos = (amount: number) => amount * 100;

if (process.env.TURSO_DATABASE_URL !== localUrl || process.env.TURSO_AUTH_TOKEN) {
	throw new Error('Este seed solo se puede ejecutar contra http://127.0.0.1:8080 sin token remoto.');
}

type Movement = typeof transactions.$inferInsert;
const movements: Movement[] = [];
const splits: (typeof transaction_splits.$inferInsert)[] = [];

function addExpense(input: {
	id: string;
	date: string;
	month: string;
	description: string;
	amount: number;
	paymentMethodId: string;
	cardId?: string | null;
	installmentGroupId?: string | null;
	recurringRuleId?: string | null;
	responsibilities: Array<{ personId: string; amount: number }>;
}) {
	movements.push({
		id: input.id,
		date: input.date,
		month: input.month,
		type: 'expense',
		amount: pesos(input.amount),
		description: input.description,
		payer_person_id: 'owner_1',
		payment_method_id: input.paymentMethodId,
		card_id: input.cardId ?? null,
		installment_group_id: input.installmentGroupId ?? null,
		recurring_rule_id: input.recurringRuleId ?? null,
		status: 'active',
		notes: demoNote,
	});
	for (const [index, responsibility] of input.responsibilities.entries()) {
		splits.push({
			id: `${input.id}-split-${index + 1}`,
			transaction_id: input.id,
			person_id: responsibility.personId,
			amount: pesos(responsibility.amount),
		});
	}
}

function addInstallmentGroup(input: {
	id: string;
	description: string;
	total: number;
	installments: number;
	responsibilities: Array<{ personId: string; amount: number }>;
	cardId: string;
	paymentMethodId: string;
	day: number;
}) {
	const monthlyAmount = input.responsibilities.reduce((sum, item) => sum + item.amount, 0);
	if (monthlyAmount * input.installments !== input.total) {
		throw new Error(`Las cuotas de ${input.description} no coinciden con el total declarado.`);
	}
	for (const [index, month] of ['2026-09', '2026-10', '2026-11'].entries()) {
		const installmentNumber = index + 1;
		const id = `${input.id}-${month}`;
		addExpense({
			id,
			date: `${month}-${String(input.day).padStart(2, '0')}`,
			month,
			description: `${input.description} (Cuota ${installmentNumber}/${input.installments})`,
			amount: monthlyAmount,
			paymentMethodId: input.paymentMethodId,
			cardId: input.cardId,
			installmentGroupId: input.id,
			responsibilities: input.responsibilities,
		});
	}
}

addInstallmentGroup({
	id: 'demo-group-notebook', description: 'Notebook', total: 1_200_000, installments: 12,
	responsibilities: [{ personId: 'owner_1', amount: 100_000 }],
	cardId: 'demo-card-icbc', paymentMethodId: 'demo-method-icbc', day: 20,
});
addInstallmentGroup({
	id: 'demo-group-auriculares', description: 'Auriculares', total: 180_000, installments: 6,
	responsibilities: [{ personId: 'demo-leo', amount: 30_000 }],
	cardId: 'demo-card-naranja', paymentMethodId: 'demo-method-naranja', day: 10,
});
addInstallmentGroup({
	id: 'demo-group-heladera', description: 'Heladera', total: 270_000, installments: 3,
	responsibilities: [{ personId: 'demo-leo', amount: 50_000 }, { personId: 'demo-euge', amount: 40_000 }],
	cardId: 'demo-card-naranja', paymentMethodId: 'demo-method-naranja', day: 10,
});
addInstallmentGroup({
	id: 'demo-group-celular', description: 'Celular', total: 405_000, installments: 9,
	responsibilities: [{ personId: 'demo-papa', amount: 45_000 }],
	cardId: 'demo-card-icbc', paymentMethodId: 'demo-method-icbc', day: 20,
});
addInstallmentGroup({
	id: 'demo-group-service', description: 'Service del auto', total: 390_000, installments: 6,
	responsibilities: [{ personId: 'demo-papa', amount: 65_000 }],
	cardId: 'demo-card-icbc', paymentMethodId: 'demo-method-icbc', day: 20,
});
addInstallmentGroup({
	id: 'demo-group-zapatillas', description: 'Zapatillas', total: 100_000, installments: 4,
	responsibilities: [{ personId: 'demo-euge', amount: 25_000 }],
	cardId: 'demo-card-naranja', paymentMethodId: 'demo-method-naranja', day: 10,
});

for (const month of ['2026-09', '2026-10', '2026-11']) {
	const isOctober = month === '2026-10';
	const isNovember = month === '2026-11';
	addExpense({
		id: `demo-market-${month}`, date: `${month}-08`, month,
		description: 'Supermercado del barrio', amount: isOctober ? 62_700 : isNovember ? 74_100 : 58_400,
		paymentMethodId: 'demo-method-naranja', cardId: 'demo-card-naranja',
		responsibilities: [{ personId: 'owner_1', amount: isOctober ? 35_000 : isNovember ? 44_100 : 30_000 },
			{ personId: 'demo-leo', amount: isOctober ? 27_700 : isNovember ? 30_000 : 28_400 }],
	});
	addExpense({
		id: `demo-rappi-${month}`, date: `${month}-12`, month,
		description: 'Suscripción Rappi', amount: 5_000,
		paymentMethodId: 'demo-method-naranja', cardId: 'demo-card-naranja',
		responsibilities: [{ personId: 'owner_1', amount: 5_000 }],
	});
	addExpense({
		id: `demo-farmacia-${month}`, date: `${month}-15`, month,
		description: 'Farmacia', amount: 9_800,
		paymentMethodId: 'demo-method-cash',
		responsibilities: [{ personId: 'demo-euge', amount: 9_800 }],
	});
	movements.push({
		id: `demo-salary-${month}`, date: `${month}-01`, month, type: 'income', amount: pesos(1_500_000),
		description: 'Sueldo ficticio', payer_person_id: 'owner_1', payment_method_id: 'demo-method-transfer',
		status: 'active', notes: demoNote,
	});
}

const recurringRules: (typeof recurring_rules.$inferInsert)[] = [
	{ id: 'demo-rule-internet', description: 'Internet hogar', amount: pesos(18_000), type: 'expense', payer_person_id: 'owner_1', payment_method_id: 'demo-method-debit', frequency: 'monthly', day_of_month: 5, active: true },
	{ id: 'demo-rule-streaming', description: 'Streaming', amount: pesos(8_500), type: 'expense', payer_person_id: 'owner_1', payment_method_id: 'demo-method-naranja', card_id: 'demo-card-naranja', frequency: 'monthly', day_of_month: 10, active: true },
	{ id: 'demo-rule-gym', description: 'Gimnasio', amount: pesos(22_000), type: 'expense', payer_person_id: 'owner_1', payment_method_id: 'demo-method-icbc', card_id: 'demo-card-icbc', frequency: 'monthly', day_of_month: 20, active: true },
];

for (const month of ['2026-10', '2026-11']) {
	for (const [ruleId, description, amount, methodId, cardId] of [
		['demo-rule-internet', 'Internet hogar', 18_000, 'demo-method-debit', null],
		['demo-rule-streaming', 'Streaming', 8_500, 'demo-method-naranja', 'demo-card-naranja'],
		['demo-rule-gym', 'Gimnasio', 22_000, 'demo-method-icbc', 'demo-card-icbc'],
	] as const) {
		addExpense({
			id: `${ruleId}-${month}`, date: `${month}-05`, month, description, amount,
			paymentMethodId: methodId, cardId, recurringRuleId: ruleId,
			responsibilities: [{ personId: 'owner_1', amount }],
		});
	}
}

movements.push({
	id: 'demo-income-extra-october', date: '2026-10-18', month: '2026-10', type: 'income', amount: pesos(85_000),
	description: 'Reintegro ficticio', payer_person_id: 'owner_1', payment_method_id: 'demo-method-transfer',
	status: 'active', notes: demoNote,
});

async function main() {
	try {
	await db.transaction(async (tx) => {
		const [owner] = await tx.select({ id: people.id }).from(people).where(and(eq(people.id, 'owner_1'), eq(people.is_owner, true))).limit(1);
		const [userRow] = await tx.select({ id: user.id }).from(user).limit(1);
		const [ledger] = userRow
			? await tx.select({ ownerUserId: ledger_accounts.owner_user_id }).from(ledger_accounts).where(eq(ledger_accounts.owner_user_id, userRow.id)).limit(1)
			: [];
		if (!owner || !userRow || !ledger) throw new Error('No existe la cuenta local única vinculada al ledger financiero.');

		const [existingPerson] = await tx.select({ id: people.id }).from(people).where(ne(people.id, 'owner_1')).limit(1);
		const [existingCard] = await tx.select({ id: cards.id }).from(cards).limit(1);
		const [existingMethod] = await tx.select({ id: payment_methods.id }).from(payment_methods).limit(1);
		const [existingGroup] = await tx.select({ id: installment_groups.id }).from(installment_groups).limit(1);
		const [existingRule] = await tx.select({ id: recurring_rules.id }).from(recurring_rules).limit(1);
		const [existingMovement] = await tx.select({ id: transactions.id }).from(transactions).limit(1);
		if (existingPerson || existingCard || existingMethod || existingGroup || existingRule || existingMovement) {
			throw new Error('La base local ya tiene datos; no se insertó nada para evitar mezclar o duplicar información.');
		}

		await tx.insert(people).values([
			{ id: 'demo-leo', name: 'Leo', is_owner: false },
			{ id: 'demo-euge', name: 'Euge', is_owner: false },
			{ id: 'demo-papa', name: 'Papá', is_owner: false },
		]);
		await tx.insert(cards).values([
			{ id: 'demo-card-naranja', name: 'Naranja', owner_person_id: 'owner_1', color: '#f97316', closing_day: 25, due_day: 10 },
			{ id: 'demo-card-icbc', name: 'ICBC', owner_person_id: 'owner_1', color: '#dc2626', closing_day: 5, due_day: 20 },
		]);
		await tx.insert(payment_methods).values([
			{ id: 'demo-method-naranja', name: 'Tarjeta Naranja', type: 'credit_card', card_id: 'demo-card-naranja', color: '#f97316' },
			{ id: 'demo-method-icbc', name: 'Tarjeta ICBC', type: 'credit_card', card_id: 'demo-card-icbc', color: '#dc2626' },
			{ id: 'demo-method-transfer', name: 'Transferencia', type: 'transfer' },
			{ id: 'demo-method-debit', name: 'Débito', type: 'debit' },
			{ id: 'demo-method-cash', name: 'Efectivo', type: 'cash' },
		]);
		await tx.insert(installment_groups).values([
			{ id: 'demo-group-notebook', description: 'Notebook', total_amount: pesos(1_200_000), installments_total: 12, start_month: '2026-09' },
			{ id: 'demo-group-auriculares', description: 'Auriculares', total_amount: pesos(180_000), installments_total: 6, start_month: '2026-09' },
			{ id: 'demo-group-heladera', description: 'Heladera', total_amount: pesos(270_000), installments_total: 3, start_month: '2026-09' },
			{ id: 'demo-group-celular', description: 'Celular', total_amount: pesos(405_000), installments_total: 9, start_month: '2026-09' },
			{ id: 'demo-group-service', description: 'Service del auto', total_amount: pesos(390_000), installments_total: 6, start_month: '2026-09' },
			{ id: 'demo-group-zapatillas', description: 'Zapatillas', total_amount: pesos(100_000), installments_total: 4, start_month: '2026-09' },
		]);
		await tx.insert(recurring_rules).values(recurringRules);
		await tx.insert(transactions).values(movements);
		await tx.insert(transaction_splits).values(splits);
	});
	console.log(`Datos demo cargados: 4 personas, 2 tarjetas, 6 compras en cuotas, ${movements.length} movimientos y 3 gastos recurrentes.`);
	} finally {
		client.close();
	}
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
