import { and, asc, count, eq, gt, gte, inArray, lte, or, sql, type SQL } from 'drizzle-orm';
import type { db } from '@/db';
import { assertPrivateLedgerOwner, getMonthlyExpenseLedgerSnapshot } from '@/lib/expense-ledger-service';
import { cards, installment_groups, payment_methods, people, transaction_splits, transactions } from '@/db/schema';
import { isValidISODate, isValidYearMonth } from '@/lib/transaction-domain';

export type McpTransactionSearch = {
	month?: string;
	from_month?: string;
	to_month?: string;
	date_from?: string;
	date_to?: string;
	person_id?: string;
	payer_person_id?: string;
	card_id?: string;
	payment_method_id?: string;
	type?: 'expense' | 'income';
	status?: 'active' | 'void';
	min_amount_cents?: number;
	max_amount_cents?: number;
	description_contains?: string;
	limit: number;
	cursor?: string;
};

function queryFingerprint(input: McpTransactionSearch) {
	return JSON.stringify({
		month: input.month ?? null, from_month: input.from_month ?? null, to_month: input.to_month ?? null,
		date_from: input.date_from ?? null, date_to: input.date_to ?? null,
		person_id: input.person_id ?? null, payer_person_id: input.payer_person_id ?? null,
		card_id: input.card_id ?? null, payment_method_id: input.payment_method_id ?? null,
		type: input.type ?? null, status: input.status ?? 'active',
		min_amount_cents: input.min_amount_cents ?? null, max_amount_cents: input.max_amount_cents ?? null,
		description_contains: input.description_contains?.trim().toLocaleLowerCase('es') ?? null,
	});
}

function decodeCursor(cursor: string | undefined, fingerprint: string) {
	if (!cursor) return null;
	try {
		const decoded: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
		if (!decoded || typeof decoded !== 'object') throw new Error();
		const value = decoded as { date?: unknown; id?: unknown; fingerprint?: unknown };
		if (value.fingerprint !== fingerprint || typeof value.id !== 'string' || !isValidISODate(String(value.date))) throw new Error();
		return { date: String(value.date), id: value.id };
	} catch {
		throw new RangeError('El cursor no es válido o pertenece a otros filtros; iniciá una búsqueda nueva.');
	}
}

function encodeCursor(date: string, id: string, fingerprint: string) {
	return Buffer.from(JSON.stringify({ date, id, fingerprint })).toString('base64url');
}

export async function searchMcpTransactions(database: typeof db, ownerUserId: string, input: McpTransactionSearch) {
	await assertPrivateLedgerOwner(database, ownerUserId);
	if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 100) throw new RangeError('El límite debe estar entre 1 y 100.');
	if (input.month && (input.from_month || input.to_month)) throw new RangeError('Usá un mes exacto o un rango de meses, no ambos.');
	if (input.month && !isValidYearMonth(input.month)) throw new RangeError('El mes debe ser AAAA-MM válido.');
	if (input.from_month && !isValidYearMonth(input.from_month)) throw new RangeError('El mes inicial debe ser AAAA-MM válido.');
	if (input.to_month && !isValidYearMonth(input.to_month)) throw new RangeError('El mes final debe ser AAAA-MM válido.');
	if (input.from_month && input.to_month && input.from_month > input.to_month) throw new RangeError('El rango de meses está invertido.');
	if (input.date_from && !isValidISODate(input.date_from)) throw new RangeError('La fecha inicial debe ser AAAA-MM-DD válida.');
	if (input.date_to && !isValidISODate(input.date_to)) throw new RangeError('La fecha final debe ser AAAA-MM-DD válida.');
	if (input.date_from && input.date_to && input.date_from > input.date_to) throw new RangeError('El rango de fechas está invertido.');
	if (input.min_amount_cents !== undefined && (!Number.isSafeInteger(input.min_amount_cents) || input.min_amount_cents < 0)) throw new RangeError('El importe mínimo debe ser un entero de centavos no negativo.');
	if (input.max_amount_cents !== undefined && (!Number.isSafeInteger(input.max_amount_cents) || input.max_amount_cents < 0)) throw new RangeError('El importe máximo debe ser un entero de centavos no negativo.');
	if (input.min_amount_cents !== undefined && input.max_amount_cents !== undefined && input.min_amount_cents > input.max_amount_cents) throw new RangeError('El rango de importes está invertido.');
	if (input.description_contains !== undefined && (input.description_contains.trim().length < 2 || input.description_contains.length > 100)) throw new RangeError('La búsqueda por descripción debe tener entre 2 y 100 caracteres.');

	const conditions: SQL[] = [];
	if (input.month) conditions.push(eq(transactions.month, input.month));
	if (input.from_month) conditions.push(gte(transactions.month, input.from_month));
	if (input.to_month) conditions.push(lte(transactions.month, input.to_month));
	if (input.date_from) conditions.push(gte(transactions.date, input.date_from));
	if (input.date_to) conditions.push(lte(transactions.date, input.date_to));
	if (input.payer_person_id) conditions.push(eq(transactions.payer_person_id, input.payer_person_id));
	if (input.card_id) conditions.push(eq(transactions.card_id, input.card_id));
	if (input.payment_method_id) conditions.push(eq(transactions.payment_method_id, input.payment_method_id));
	if (input.type) conditions.push(eq(transactions.type, input.type));
	conditions.push(eq(transactions.status, input.status ?? 'active'));
	if (input.min_amount_cents !== undefined) conditions.push(gte(transactions.amount, input.min_amount_cents));
	if (input.max_amount_cents !== undefined) conditions.push(lte(transactions.amount, input.max_amount_cents));
	if (input.description_contains?.trim()) {
		conditions.push(sql`instr(lower(${transactions.description}), lower(${input.description_contains.trim()})) > 0`);
	}
	if (input.person_id) {
		const matchingSplits = database.select({ transactionId: transaction_splits.transaction_id })
			.from(transaction_splits).where(eq(transaction_splits.person_id, input.person_id));
		conditions.push(inArray(transactions.id, matchingSplits));
	}

	const fingerprint = queryFingerprint(input);
	const cursor = decodeCursor(input.cursor, fingerprint);
	const baseWhere = conditions.length ? and(...conditions) : undefined;
	const [countRow] = await database.select({ total: count() }).from(transactions).where(baseWhere);
	const pageWhere = cursor
		? and(baseWhere, or(gt(transactions.date, cursor.date), and(eq(transactions.date, cursor.date), gt(transactions.id, cursor.id))))
		: baseWhere;
	const rows = await database.select().from(transactions).where(pageWhere)
		.orderBy(asc(transactions.date), asc(transactions.id)).limit(input.limit + 1);
	const hasMore = rows.length > input.limit;
	const page = rows.slice(0, input.limit);
	const ids = page.map((row) => row.id);
	const [splits, allPeople, allCards, allMethods] = ids.length
		? await Promise.all([
			database.select().from(transaction_splits).where(inArray(transaction_splits.transaction_id, ids)),
			database.select({ id: people.id, name: people.name }).from(people),
			database.select({ id: cards.id, name: cards.name }).from(cards),
			database.select({ id: payment_methods.id, name: payment_methods.name }).from(payment_methods),
		])
		: [[], [], [], []];
	const peopleById = new Map(allPeople.map((person) => [person.id, person.name]));
	const cardsById = new Map(allCards.map((card) => [card.id, card.name]));
	const methodsById = new Map(allMethods.map((method) => [method.id, method.name]));
	const splitsByTransaction = new Map<string, typeof splits>();
	for (const split of splits) {
		const matching = splitsByTransaction.get(split.transaction_id) ?? [];
		matching.push(split);
		splitsByTransaction.set(split.transaction_id, matching);
	}
	return {
		currency: 'ARS', unit: 'centavos',
		amount_semantics: 'amount_cents es el importe de este movimiento o cuota registrada, no necesariamente el total original de compra.',
		date_semantics: 'date es la fecha guardada en esta fila; para compras en cuotas puede ser la fecha asignada a la cuota. impact_month filtra el mes de impacto/cierre guardado.',
		filters: { ...input, cursor: undefined, status: input.status ?? 'active' },
		total_matching_records: countRow?.total ?? 0,
		records: page.map((row) => ({
			id: row.id, type: row.type, date: row.date, impact_month: row.month, amount_cents: row.amount,
			description: row.description, status: row.status,
			payer: { id: row.payer_person_id, name: peopleById.get(row.payer_person_id) ?? 'Persona no encontrada' },
			card: row.card_id ? { id: row.card_id, name: cardsById.get(row.card_id) ?? 'Tarjeta no encontrada' } : null,
			payment_method: { id: row.payment_method_id, name: methodsById.get(row.payment_method_id) ?? 'Medio de pago no encontrado' },
			installment_group_id: row.installment_group_id,
			responsibilities: (splitsByTransaction.get(row.id) ?? []).map((split) => ({ person_id: split.person_id, person: peopleById.get(split.person_id) ?? 'Persona no encontrada', amount_cents: split.amount })),
		})),
		next_cursor: hasMore && page.length ? encodeCursor(page[page.length - 1].date, page[page.length - 1].id, fingerprint) : null,
	};
}

export async function getMcpCardStatement(database: typeof db, ownerUserId: string, cardId: string, month: string) {
	const snapshot = await getMonthlyExpenseLedgerSnapshot(database, ownerUserId, month);
	const card = snapshot.cards.find((item) => item.id === cardId);
	if (!card) return null;
	const transactionsForCard = snapshot.transactions.filter((item) => item.type === 'expense' && item.card_id === cardId);
	const ids = new Set(transactionsForCard.map((item) => item.id));
	const splits = snapshot.splits.filter((split) => ids.has(split.transaction_id));
	const byPerson = new Map(snapshot.people.map((person) => [person.id, { person: person.name, total_cents: 0, movements_count: 0 }]));
	for (const split of splits) {
		const entry = byPerson.get(split.person_id);
		if (entry) { entry.total_cents += split.amount; entry.movements_count += 1; }
	}
	return {
		card: { id: card.id, name: card.name }, month, currency: 'ARS', unit: 'centavos',
		movement_total_cents: transactionsForCard.reduce((total, item) => total + item.amount, 0),
		movements_count: transactionsForCard.length,
		totals_by_responsible: Array.from(byPerson.entries()).filter(([, value]) => value.movements_count > 0).map(([person_id, value]) => ({ person_id, ...value })),
		payment_status: 'unknown; Finanzar no registra si este resumen fue pagado',
		bank_fees_or_taxes: 'not included unless they exist as explicit movements in Finanzar',
	};
}

export type McpSummaryDimension = 'person' | 'card' | 'payment_method' | 'payer' | 'month';

export async function getMcpSpendingSummary(database: typeof db, ownerUserId: string, input: {
	from_month?: string;
	to_month?: string;
	type: 'expense' | 'income' | 'all';
	status: 'active' | 'void' | 'all';
	person_id?: string;
	payer_person_id?: string;
	card_id?: string;
	payment_method_id?: string;
	group_by: McpSummaryDimension[];
}) {
	await assertPrivateLedgerOwner(database, ownerUserId);
	if (input.from_month && !isValidYearMonth(input.from_month)) throw new RangeError('El mes inicial debe ser AAAA-MM válido.');
	if (input.to_month && !isValidYearMonth(input.to_month)) throw new RangeError('El mes final debe ser AAAA-MM válido.');
	if (input.from_month && input.to_month && input.from_month > input.to_month) throw new RangeError('El rango de meses está invertido.');
	if (input.group_by.length > 2 || new Set(input.group_by).size !== input.group_by.length) throw new RangeError('Elegí hasta dos criterios distintos para agrupar.');
	const filters: SQL[] = [];
	if (input.from_month) filters.push(gte(transactions.month, input.from_month));
	if (input.to_month) filters.push(lte(transactions.month, input.to_month));
	if (input.type !== 'all') filters.push(eq(transactions.type, input.type));
	if (input.status !== 'all') filters.push(eq(transactions.status, input.status));
	if (input.payer_person_id) filters.push(eq(transactions.payer_person_id, input.payer_person_id));
	if (input.card_id) filters.push(eq(transactions.card_id, input.card_id));
	if (input.payment_method_id) filters.push(eq(transactions.payment_method_id, input.payment_method_id));
	if (input.person_id) {
		const matchingSplits = database.select({ transactionId: transaction_splits.transaction_id })
			.from(transaction_splits).where(eq(transaction_splits.person_id, input.person_id));
		filters.push(inArray(transactions.id, matchingSplits));
	}
	const transactionsFound = await database.select().from(transactions).where(filters.length ? and(...filters) : undefined)
		.orderBy(asc(transactions.month), asc(transactions.date), asc(transactions.id));
	if (transactionsFound.length > 10_000) throw new RangeError('La consulta supera 10.000 movimientos; acotá el rango de meses para evitar un total incompleto.');
	const transactionIds = transactionsFound.map((item) => item.id);
	const [splits, allPeople, allCards, allMethods] = transactionIds.length
		? await Promise.all([
			database.select().from(transaction_splits).where(inArray(transaction_splits.transaction_id, transactionIds)),
			database.select({ id: people.id, name: people.name }).from(people),
			database.select({ id: cards.id, name: cards.name }).from(cards),
			database.select({ id: payment_methods.id, name: payment_methods.name }).from(payment_methods),
		])
		: [[], [], [], []];
	const peopleById = new Map(allPeople.map((item) => [item.id, item.name]));
	const cardsById = new Map(allCards.map((item) => [item.id, item.name]));
	const methodsById = new Map(allMethods.map((item) => [item.id, item.name]));
	const splitsByTransaction = new Map<string, typeof splits>();
	for (const split of splits) {
		const rows = splitsByTransaction.get(split.transaction_id) ?? [];
		rows.push(split);
		splitsByTransaction.set(split.transaction_id, rows);
	}
	const totals = new Map<string, { dimensions: Record<string, string | null>; income: number; expenses: number; movementIds: Set<string> }>();
	let detectedSplitIssues = 0;
	for (const transaction of transactionsFound) {
		const transactionSplits = splitsByTransaction.get(transaction.id) ?? [];
		const splitTotal = transactionSplits.reduce((sum, split) => sum + split.amount, 0);
		if (transaction.type === 'expense' && splitTotal !== transaction.amount) detectedSplitIssues++;
		const usesResponsibilityAmounts = input.person_id !== undefined || input.group_by.includes('person');
		const responsibilityRows = usesResponsibilityAmounts
			? transactionSplits.filter((split) => !input.person_id || split.person_id === input.person_id)
			: [null];
		const allocations = responsibilityRows.length ? responsibilityRows : (usesResponsibilityAmounts ? [null] : []);
		for (const split of allocations) {
			const values: Record<McpSummaryDimension, string | null> = {
				person: split ? (peopleById.get(split.person_id) ?? 'Persona no encontrada') : 'Sin responsable',
				card: transaction.card_id ? (cardsById.get(transaction.card_id) ?? 'Tarjeta no encontrada') : 'Sin tarjeta',
				payment_method: methodsById.get(transaction.payment_method_id) ?? 'Medio de pago no encontrado',
				payer: peopleById.get(transaction.payer_person_id) ?? 'Persona no encontrada',
				month: transaction.month,
			};
			const dimensions = Object.fromEntries(input.group_by.map((dimension) => [dimension, values[dimension]])) as Record<string, string | null>;
			const key = JSON.stringify(dimensions);
			const entry = totals.get(key) ?? { dimensions, income: 0, expenses: 0, movementIds: new Set<string>() };
			const amount = split ? split.amount : transaction.amount;
			if (transaction.type === 'income') entry.income += amount;
			else entry.expenses += amount;
			entry.movementIds.add(transaction.id);
			totals.set(key, entry);
		}
	}
	return {
		currency: 'ARS', unit: 'centavos', amount_semantics: input.person_id || input.group_by.includes('person')
			? 'Cuando aparece responsable, se suma solo la parte asignada a esa persona; payer_person_id es independiente.'
			: 'Se suma el importe completo de cada movimiento o cuota registrada, no el total original de compra.',
		filters: { ...input },
		movements_count: transactionsFound.length,
		integrity_warnings: detectedSplitIssues ? [`${detectedSplitIssues} egreso(s) tienen divisiones cuya suma no coincide con el importe del movimiento.`] : [],
		groups: Array.from(totals.values()).map(({ dimensions, income, expenses, movementIds }) => ({
			dimensions, income_cents: income, expenses_cents: expenses, net_cents: income - expenses,
			movements_count: movementIds.size,
		})).sort((a, b) => JSON.stringify(a.dimensions).localeCompare(JSON.stringify(b.dimensions))),
	};
}

export async function auditMcpFinancialData(database: typeof db, ownerUserId: string, options: {
	from_month?: string;
	to_month?: string;
	limit: number;
}) {
	await assertPrivateLedgerOwner(database, ownerUserId);
	if (options.from_month && !isValidYearMonth(options.from_month)) throw new RangeError('El mes inicial debe ser AAAA-MM válido.');
	if (options.to_month && !isValidYearMonth(options.to_month)) throw new RangeError('El mes final debe ser AAAA-MM válido.');
	if (options.from_month && options.to_month && options.from_month > options.to_month) throw new RangeError('El rango de meses está invertido.');
	if (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > 100) throw new RangeError('El límite de resultados debe estar entre 1 y 100.');
	const filters: SQL[] = [];
	if (options.from_month) filters.push(gte(transactions.month, options.from_month));
	if (options.to_month) filters.push(lte(transactions.month, options.to_month));
	const rows = await database.select().from(transactions).where(filters.length ? and(...filters) : undefined)
		.orderBy(asc(transactions.month), asc(transactions.date), asc(transactions.id)).limit(20_001);
	if (rows.length > 20_000) throw new RangeError('La auditoría supera 20.000 movimientos; acotá el rango de meses.');
	const ids = rows.map((row) => row.id);
	const [splits, methods, groups] = ids.length
		? await Promise.all([
			database.select().from(transaction_splits).where(inArray(transaction_splits.transaction_id, ids)),
			database.select().from(payment_methods),
			database.select().from(installment_groups),
		])
		: [[], await database.select().from(payment_methods), await database.select().from(installment_groups)];
	const splitSums = new Map<string, number>();
	const splitCounts = new Map<string, number>();
	for (const split of splits) {
		splitSums.set(split.transaction_id, (splitSums.get(split.transaction_id) ?? 0) + split.amount);
		splitCounts.set(split.transaction_id, (splitCounts.get(split.transaction_id) ?? 0) + 1);
	}
	const methodsById = new Map(methods.map((method) => [method.id, method]));
	const findings: Array<Record<string, unknown>> = [];
	const addFinding = (finding: Record<string, unknown>) => { if (findings.length < options.limit) findings.push(finding); };
	let expensesMissingResponsibilities = 0;
	let splitAmountMismatches = 0;
	let cardPaymentMethodMismatches = 0;
	let invalidAmounts = 0;
	for (const row of rows) {
		const splitCount = splitCounts.get(row.id) ?? 0;
		const splitTotal = splitSums.get(row.id) ?? 0;
		const item = { transaction_id: row.id, date: row.date, impact_month: row.month, description: row.description };
		if (row.type === 'expense' && splitCount === 0) {
			expensesMissingResponsibilities++;
			addFinding({ ...item, issue: 'expense_without_responsible', amount_cents: row.amount });
		}
		if (splitCount > 0 && splitTotal !== row.amount) {
			splitAmountMismatches++;
			addFinding({ ...item, issue: 'splits_do_not_equal_movement', amount_cents: row.amount, splits_total_cents: splitTotal });
		}
		if (!Number.isSafeInteger(row.amount) || row.amount <= 0) {
			invalidAmounts++;
			addFinding({ ...item, issue: 'invalid_movement_amount', amount_cents: row.amount });
		}
		const method = methodsById.get(row.payment_method_id);
		if (method && (method.type === 'credit_card' ? !method.card_id || row.card_id !== method.card_id : row.card_id !== null)) {
			cardPaymentMethodMismatches++;
			addFinding({ ...item, issue: 'card_payment_method_mismatch', transaction_card_id: row.card_id, payment_method_id: method.id, payment_method_card_id: method.card_id });
		}
	}
	const groupById = new Map(groups.map((group) => [group.id, group]));
	const groupedRows = new Map<string, typeof rows>();
	for (const row of rows) {
		if (!row.installment_group_id) continue;
		const groupRows = groupedRows.get(row.installment_group_id) ?? [];
		groupRows.push(row);
		groupedRows.set(row.installment_group_id, groupRows);
	}
	let completeInstallmentGroupsChecked = 0;
	let installmentGroupTotalMismatches = 0;
	for (const [groupId, groupRows] of groupedRows) {
		const group = groupById.get(groupId);
		if (!group || groupRows.length !== group.installments_total) continue;
		completeInstallmentGroupsChecked++;
		const recordedTotal = groupRows.reduce((total, row) => total + row.amount, 0);
		if (recordedTotal !== group.total_amount) {
			installmentGroupTotalMismatches++;
			addFinding({ installment_group_id: groupId, issue: 'complete_installment_group_total_mismatch', purchase_total_cents: group.total_amount, recorded_total_cents: recordedTotal });
		}
	}
	return {
		months: { from: options.from_month ?? null, to: options.to_month ?? null },
		movements_checked: rows.length,
		summary: { expenses_missing_responsibilities: expensesMissingResponsibilities, split_amount_mismatches: splitAmountMismatches, card_payment_method_mismatches: cardPaymentMethodMismatches, invalid_movement_amounts: invalidAmounts, complete_installment_groups_checked: completeInstallmentGroupsChecked, installment_group_total_mismatches: installmentGroupTotalMismatches },
		findings_returned: findings.length,
		truncated_findings: expensesMissingResponsibilities + splitAmountMismatches + cardPaymentMethodMismatches + invalidAmounts + installmentGroupTotalMismatches > findings.length,
		findings,
		limitations: ['Una serie de cuotas parcialmente registrada no se marca como inconsistente: el esquema no conserva la cuota inicial cargada.', 'No se puede inferir si un resumen fue pagado ni reconciliar impuestos/mora que no estén cargados como movimientos.'],
	};
}
