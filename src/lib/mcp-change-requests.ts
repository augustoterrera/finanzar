import { createHash } from 'node:crypto';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import type { db } from '@/db';
import type { DatabaseTransaction } from '@/db';
import { cards, ai_audit_events, ai_change_requests, ai_idempotency, installment_groups, payment_methods, people, transaction_splits, transactions } from '@/db/schema';
import { hasActiveMcpAuthorization, hasActiveMcpConnection } from '@/lib/mcp-authorization';
import { assertPrivateLedgerOwner } from '@/lib/expense-ledger-service';
import { persistTransactionInTransaction, prepareTransaction, type CreateTransactionInput, type FinanzarTransaction, type TransactionDraft } from '@/lib/transaction-write-service';

export const MCP_TRANSACTION_WRITE_SCOPE = 'finanzar:transactions:write';
export const MCP_REQUIRED_WRITE_SCOPES = ['finanzar:read', MCP_TRANSACTION_WRITE_SCOPE] as const;
export const MCP_PROPOSAL_TTL_MS = 30 * 60 * 1000;
const MAX_PROPOSAL_PAYLOAD_BYTES = 32 * 1024;

export class McpChangeRequestError extends Error {
	constructor(readonly code: 'FORBIDDEN_SCOPE' | 'IDEMPOTENCY_CONFLICT' | 'INVALID_PROPOSAL' | 'NOT_FOUND' | 'CONFLICT' | 'EXPIRED', message: string) {
		super(message);
		this.name = 'McpChangeRequestError';
	}
}

function canonicalJson(value: unknown): string {
	if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
	if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
	if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
	if (typeof value === 'object') {
		const entries = Object.entries(value as Record<string, unknown>)
			.filter(([, item]) => item !== undefined)
			.sort(([a], [b]) => a.localeCompare(b));
		return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`;
	}
	throw new McpChangeRequestError('INVALID_PROPOSAL', 'La propuesta contiene datos que no se pueden serializar.');
}

function hashJson(value: unknown) {
	return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

function centsAsDecimal(cents: number) {
	if (!Number.isSafeInteger(cents) || cents < 0) throw new McpChangeRequestError('INVALID_PROPOSAL', 'Los importes deben ser centavos enteros no negativos.');
	return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}

function assertIdempotencyKey(value: string) {
	if (!/^[A-Za-z0-9._:-]{8,128}$/.test(value)) {
		throw new McpChangeRequestError('INVALID_PROPOSAL', 'La clave idempotente debe tener entre 8 y 128 caracteres seguros.');
	}
}

export function toTransactionDraft(input: {
	type: 'income' | 'expense';
	date: string;
	amount_cents: number;
	description: string;
	payer_person_id: string;
	payment_method_id: string;
	responsibilities: Array<{ person_id: string; amount_cents: number }>;
	installments_total: number;
	starting_installment: number;
	impact_month?: string;
}): TransactionDraft {
	return {
		type: input.type,
		date: input.date,
		amount: centsAsDecimal(input.amount_cents),
		description: input.description,
		payerPersonId: input.payer_person_id,
		paymentMethodId: input.payment_method_id,
		splitsJson: JSON.stringify(input.responsibilities.map((split) => ({ person_id: split.person_id, amount: centsAsDecimal(split.amount_cents) }))),
		installmentsTotal: String(input.installments_total),
		startingInstallment: String(input.starting_installment),
		impactMonth: input.impact_month,
	};
}

type TransactionVersion = {
	id: string; type: 'income' | 'expense'; date: string; month: string; amount: number;
	description: string; payer_person_id: string; payment_method_id: string; card_id: string | null;
	installment_group_id: string | null; recurring_rule_id: string | null; status: 'active' | 'void';
	updated_at: string; splits: Array<{ person_id: string; amount: number }>;
};

type UpdateTransactionDraftInput = {
	transaction_id: string; idempotency_key: string; date: string; amount_cents: number;
	description: string; payer_person_id: string; payment_method_id: string;
	responsibilities: Array<{ person_id: string; amount_cents: number }>;
	impact_month?: string;
};

type UpdateInstallmentGroupDraftInput = {
	installment_group_id: string;
	idempotency_key: string;
	scope: 'entire_recorded_group';
	purchase_total_cents: number;
	description: string;
	payer_person_id: string;
	payment_method_id: string;
	responsibilities: Array<{ person_id: string; amount_cents: number }>;
};

type InstallmentGroupVersion = {
	id: string;
	description: string;
	total_amount: number;
	installments_total: number;
	start_month: string;
	installments: Array<TransactionVersion & { installment_number: number }>;
};

async function readTransactionVersion(database: typeof db, ownerUserId: string, transactionId: string): Promise<TransactionVersion> {
	await assertPrivateLedgerOwner(database, ownerUserId);
	const [row] = await database.select().from(transactions).where(eq(transactions.id, transactionId)).limit(1);
	if (!row) throw new McpChangeRequestError('NOT_FOUND', 'No se encontró el movimiento solicitado.');
	const splits = await database.select({ person_id: transaction_splits.person_id, amount: transaction_splits.amount })
		.from(transaction_splits).where(eq(transaction_splits.transaction_id, transactionId));
	return {
		id: row.id, type: row.type, date: row.date, month: row.month, amount: row.amount,
		description: row.description, payer_person_id: row.payer_person_id,
		payment_method_id: row.payment_method_id, card_id: row.card_id,
		installment_group_id: row.installment_group_id, recurring_rule_id: row.recurring_rule_id,
		status: row.status, updated_at: row.updated_at,
		splits: splits.map((split) => ({ person_id: split.person_id, amount: split.amount }))
			.sort((a, b) => a.person_id.localeCompare(b.person_id)),
	};
}

async function readEditableTransaction(database: typeof db, ownerUserId: string, transactionId: string) {
	const version = await readTransactionVersion(database, ownerUserId, transactionId);
	if (version.status !== 'active') throw new McpChangeRequestError('INVALID_PROPOSAL', 'Solo se pueden editar movimientos activos.');
	if (version.installment_group_id || version.recurring_rule_id || /\bcuota\s*\d+\s*\/\s*\d+\b/i.test(version.description)) {
		throw new McpChangeRequestError('INVALID_PROPOSAL', 'Por ahora solo se pueden editar movimientos individuales, no cuotas ni movimientos recurrentes.');
	}
	return version;
}

async function readEditableInstallmentGroup(database: typeof db, ownerUserId: string, groupId: string): Promise<InstallmentGroupVersion> {
	await assertPrivateLedgerOwner(database, ownerUserId);
	const [group] = await database.select().from(installment_groups)
		.where(eq(installment_groups.id, groupId)).limit(1);
	if (!group) throw new McpChangeRequestError('NOT_FOUND', 'No se encontró la compra en cuotas solicitada.');
	const rows = await database.select({ id: transactions.id }).from(transactions)
		.where(eq(transactions.installment_group_id, groupId)).orderBy(asc(transactions.date), asc(transactions.id));
	const installments = await Promise.all(rows.map(async ({ id }) => {
		const version = await readTransactionVersion(database, ownerUserId, id);
		const match = version.description.match(/ \(Cuota (\d+)\/(\d+)\)$/i);
		if (!match || Number(match[2]) !== group.installments_total) {
			throw new McpChangeRequestError('INVALID_PROPOSAL', 'La serie tiene etiquetas de cuotas inconsistentes; no se propuso ningún cambio.');
		}
		return { ...version, installment_number: Number(match[1]) };
	})).then((items) => items.sort((a, b) => a.installment_number - b.installment_number));
	if (!installments.length || installments.some((item) => item.status !== 'active' || item.type !== 'expense')) {
		throw new McpChangeRequestError('INVALID_PROPOSAL', 'Solo se pueden corregir series activas de gastos.');
	}
	const firstNumber = installments[0].installment_number;
	if (installments.some((item, index) => item.installment_number !== firstNumber + index)
		|| installments.at(-1)?.installment_number !== group.installments_total
		|| installments[0].month !== group.start_month) {
		throw new McpChangeRequestError('INVALID_PROPOSAL', 'La serie no contiene todas las cuotas registradas desde su inicio hasta el final; no se propuso ningún cambio.');
	}
	if (installments.some((item) => item.payer_person_id !== installments[0].payer_person_id
		|| item.payment_method_id !== installments[0].payment_method_id
		|| item.card_id !== installments[0].card_id)) {
		throw new McpChangeRequestError('INVALID_PROPOSAL', 'La serie mezcla pagadores o medios de pago. Corregila desde la app antes de editarla con IA.');
	}
	return {
		id: group.id, description: group.description, total_amount: group.total_amount,
		installments_total: group.installments_total, start_month: group.start_month, installments,
	};
}

function versionDraft(version: TransactionVersion): TransactionDraft {
	return {
		type: version.type, date: version.date, impactMonth: version.month,
		amount: centsAsDecimal(version.amount), description: version.description,
		payerPersonId: version.payer_person_id, paymentMethodId: version.payment_method_id,
		splitsJson: JSON.stringify(version.splits.map((split) => ({ person_id: split.person_id, amount: centsAsDecimal(split.amount) }))),
		installmentsTotal: '1', startingInstallment: '1',
	};
}

async function buildUpdatePreview(database: typeof db, before: TransactionVersion, after: CreateTransactionInput) {
	const [allPeople, allMethods, allCards] = await Promise.all([
		database.select({ id: people.id, name: people.name }).from(people),
		database.select({ id: payment_methods.id, name: payment_methods.name }).from(payment_methods),
		database.select({ id: cards.id, name: cards.name }).from(cards),
	]);
	const names = new Map(allPeople.map((person) => [person.id, person.name]));
	const methods = new Map(allMethods.map((method) => [method.id, method.name]));
	const cardsById = new Map(allCards.map((card) => [card.id, card.name]));
	const personLabel = (id: string) => ({ id, name: names.get(id) ?? 'Persona no encontrada' });
	const beforeView = {
		type: before.type, description: before.description, date: before.date, impact_month: before.month,
		amount_cents: before.amount, payer: personLabel(before.payer_person_id),
		payment_method: { id: before.payment_method_id, name: methods.get(before.payment_method_id) ?? 'Medio no encontrado' },
		card: before.card_id ? { id: before.card_id, name: cardsById.get(before.card_id) ?? 'Tarjeta no encontrada' } : null,
		responsibilities: before.splits.map((split) => ({ ...personLabel(split.person_id), amount_cents: split.amount })),
	};
	const afterView = {
		type: after.type, description: after.description, date: after.date, impact_month: after.billingMonth,
		amount_cents: after.amountCents, payer: personLabel(after.payerPersonId),
		payment_method: { id: after.paymentMethodId, name: methods.get(after.paymentMethodId) ?? 'Medio no encontrado' },
		card: after.cardId ? { id: after.cardId, name: cardsById.get(after.cardId) ?? 'Tarjeta no encontrada' } : null,
		responsibilities: after.splits.map((split) => ({ ...personLabel(split.person_id), amount_cents: split.amount })),
	};
	return { kind: 'update_transaction', transaction_id: before.id, before: beforeView, after: afterView };
}

async function buildInstallmentGroupPreview(database: typeof db, before: InstallmentGroupVersion, after: CreateTransactionInput, scope: UpdateInstallmentGroupDraftInput['scope']) {
	const [allPeople, allMethods, allCards] = await Promise.all([
		database.select({ id: people.id, name: people.name }).from(people),
		database.select({ id: payment_methods.id, name: payment_methods.name }).from(payment_methods),
		database.select({ id: cards.id, name: cards.name }).from(cards),
	]);
	const names = new Map(allPeople.map((person) => [person.id, person.name]));
	const methods = new Map(allMethods.map((method) => [method.id, method.name]));
	const cardsById = new Map(allCards.map((card) => [card.id, card.name]));
	const personLabel = (id: string) => ({ id, name: names.get(id) ?? 'Persona no encontrada' });
	const paymentLabel = (id: string) => ({ id, name: methods.get(id) ?? 'Medio no encontrado' });
	const cardLabel = (id: string | null) => id ? { id, name: cardsById.get(id) ?? 'Tarjeta no encontrada' } : null;
	const beforePayer = before.installments[0].payer_person_id;
	return {
		kind: 'update_installment_group',
		scope,
		installment_group_id: before.id,
		before: {
			description: before.description, purchase_total_cents: before.total_amount,
			installments_total: before.installments_total, start_month: before.start_month,
			payer: personLabel(beforePayer), payment_method: paymentLabel(before.installments[0].payment_method_id),
			card: cardLabel(before.installments[0].card_id),
			installments: before.installments.map((item) => ({
				transaction_id: item.id, installment_number: item.installment_number, date: item.date, month: item.month,
				amount_cents: item.amount,
				responsibilities: item.splits.map((split) => ({ ...personLabel(split.person_id), amount_cents: split.amount })),
			})),
		},
		after: {
			description: after.description, purchase_total_cents: after.amountCents,
			installments_total: after.installmentsTotal, start_month: after.billingMonth,
			payer: personLabel(after.payerPersonId), payment_method: paymentLabel(after.paymentMethodId),
			card: cardLabel(after.cardId),
			installments: after.schedule.map((item) => ({
				installment_number: item.installmentNumber, date: item.date, month: item.month,
				amount_cents: item.amount,
				responsibilities: item.splits.map((split) => ({ ...personLabel(split.person_id), amount_cents: split.amount })),
			})),
		},
	};
}

export async function buildTransactionProposalPreview(database: typeof db, ownerUserId: string, input: CreateTransactionInput) {
	const [allPeople, allCards, allMethods] = await Promise.all([
		database.select({ id: people.id, name: people.name }).from(people),
		database.select({ id: cards.id, name: cards.name }).from(cards),
		database.select({ id: payment_methods.id, name: payment_methods.name }).from(payment_methods),
	]);
	const personNames = new Map(allPeople.map((person) => [person.id, person.name]));
	const method = allMethods.find((item) => item.id === input.paymentMethodId);
	const card = input.cardId ? allCards.find((item) => item.id === input.cardId) : null;
	const installments = input.installmentsTotal === 1
		? [{ installment_number: 1, date: input.date, month: input.billingMonth, amount_cents: input.amountCents, responsibilities: input.splits }]
		: input.schedule.map((item) => ({ installment_number: item.installmentNumber, date: item.date, month: item.month, amount_cents: item.amount, responsibilities: item.splits }));
	if (!method || (input.cardId && !card)) throw new McpChangeRequestError('CONFLICT', 'Cambió el medio de pago o la tarjeta. Generá una propuesta nueva.');
	return {
		type: input.type,
		description: input.description,
		date: input.date,
		impact_month: input.billingMonth,
		amount_cents: input.amountCents,
		purchase_total_cents: input.amountCents,
		payer: { id: input.payerPersonId, name: personNames.get(input.payerPersonId) ?? 'Persona no encontrada' },
		payment_method: { id: input.paymentMethodId, name: method.name },
		card: card ? { id: card.id, name: card.name } : null,
		installments_total: input.installmentsTotal,
		installments_to_record: installments.map((item) => ({
			installment_number: item.installment_number,
			date: item.date,
			month: item.month,
			amount_cents: item.amount_cents,
			responsibilities: item.responsibilities.map((split) => ({
				person_id: split.person_id,
				person: personNames.get(split.person_id) ?? 'Persona no encontrada',
				amount_cents: split.amount,
			})),
		})),
	};
}

async function findByIdempotencyKey(database: typeof db, input: {
	ownerUserId: string; clientId: string; operation: string; idempotencyKey: string;
}) {
	const [row] = await database.select({
		changeRequestId: ai_idempotency.change_request_id,
		payloadHash: ai_idempotency.payload_hash,
	}).from(ai_idempotency).where(and(
		eq(ai_idempotency.owner_user_id, input.ownerUserId),
		eq(ai_idempotency.client_id, input.clientId),
		eq(ai_idempotency.operation, input.operation),
		eq(ai_idempotency.idempotency_key, input.idempotencyKey),
	)).limit(1);
	return row ?? null;
}

async function storeChangeProposal(database: typeof db, input: {
	ownerUserId: string; clientId: string; operation: string; idempotencyKey: string;
	payload: unknown; preview: Record<string, unknown>; entityVersions?: unknown; now: number;
}) {
	const idempotencyInput = {
		ownerUserId: input.ownerUserId, clientId: input.clientId,
		operation: input.operation, idempotencyKey: input.idempotencyKey,
	};
	const payloadJson = canonicalJson(input.payload);
	if (Buffer.byteLength(payloadJson, 'utf8') > MAX_PROPOSAL_PAYLOAD_BYTES) {
		throw new McpChangeRequestError('INVALID_PROPOSAL', 'La propuesta supera el tamaño máximo permitido.');
	}
	const payloadHash = hashJson({ operation: input.operation, payload: input.payload });
	const existing = await findByIdempotencyKey(database, idempotencyInput);
	if (existing) {
		if (existing.payloadHash !== payloadHash) throw new McpChangeRequestError('IDEMPOTENCY_CONFLICT', 'La clave ya se usó con otros datos. Usá una clave nueva.');
		const [proposal] = await database.select().from(ai_change_requests).where(eq(ai_change_requests.id, existing.changeRequestId)).limit(1);
		if (!proposal) throw new McpChangeRequestError('CONFLICT', 'La clave apunta a una propuesta inexistente.');
		return { id: proposal.id, state: proposal.state, expires_at: proposal.expires_at, preview: JSON.parse(proposal.preview_json) as Record<string, unknown>, reused: true };
	}

	const proposalId = crypto.randomUUID();
	const expiresAt = new Date(input.now + MCP_PROPOSAL_TTL_MS);
	const previewJson = canonicalJson(input.preview);
	try {
		await database.transaction(async (tx) => {
			const raced = await tx.select({ changeRequestId: ai_idempotency.change_request_id, payloadHash: ai_idempotency.payload_hash })
				.from(ai_idempotency).where(and(
					eq(ai_idempotency.owner_user_id, input.ownerUserId),
					eq(ai_idempotency.client_id, input.clientId),
					eq(ai_idempotency.operation, input.operation),
					eq(ai_idempotency.idempotency_key, input.idempotencyKey),
				)).limit(1);
			if (raced[0]) throw new McpChangeRequestError(
				raced[0].payloadHash === payloadHash ? 'CONFLICT' : 'IDEMPOTENCY_CONFLICT',
				'La solicitud idempotente se está procesando. Reintentá con la misma clave.',
			);
			await tx.insert(ai_change_requests).values({
				id: proposalId, owner_user_id: input.ownerUserId, client_id: input.clientId,
				operation: input.operation, payload_json: payloadJson, payload_hash: payloadHash,
				preview_json: previewJson, entity_versions_json: input.entityVersions === undefined ? '{}' : canonicalJson(input.entityVersions),
				state: 'pending', expires_at: expiresAt,
			});
			await tx.insert(ai_idempotency).values({
				owner_user_id: input.ownerUserId, client_id: input.clientId, operation: input.operation,
				idempotency_key: input.idempotencyKey, payload_hash: payloadHash, change_request_id: proposalId,
			});
			await tx.insert(ai_audit_events).values({
				owner_user_id: input.ownerUserId, change_request_id: proposalId, actor_type: 'ai_connection',
				actor_id: input.clientId, event_type: 'proposal_created',
				metadata_json: canonicalJson({ operation: input.operation, payload_hash: payloadHash }),
			});
		});
	} catch (error) {
		if (error instanceof McpChangeRequestError) throw error;
		const raced = await findByIdempotencyKey(database, idempotencyInput);
		if (raced) {
			if (raced.payloadHash !== payloadHash) throw new McpChangeRequestError('IDEMPOTENCY_CONFLICT', 'La clave ya se usó con otros datos. Usá una clave nueva.');
			const [proposal] = await database.select().from(ai_change_requests).where(eq(ai_change_requests.id, raced.changeRequestId)).limit(1);
			if (proposal) return { id: proposal.id, state: proposal.state, expires_at: proposal.expires_at, preview: JSON.parse(proposal.preview_json) as Record<string, unknown>, reused: true };
		}
		throw error;
	}
	const [proposal] = await database.select({ state: ai_change_requests.state }).from(ai_change_requests).where(eq(ai_change_requests.id, proposalId)).limit(1);
	if (!proposal) throw new McpChangeRequestError('CONFLICT', 'No se pudo recuperar la propuesta guardada.');
	return { id: proposalId, state: proposal.state, expires_at: expiresAt, preview: input.preview, reused: false };
}

export async function createMcpTransactionProposal(database: typeof db, input: {
	ownerUserId: string;
	clientId: string;
	jti: string;
	scopes: string[];
	idempotencyKey: string;
	draft: TransactionDraft;
	now?: number;
}) {
	const now = input.now ?? Date.now();
	if (!input.scopes.includes(MCP_TRANSACTION_WRITE_SCOPE) || !input.scopes.includes('finanzar:read')) {
		throw new McpChangeRequestError('FORBIDDEN_SCOPE', 'Esta conexión no tiene permiso para proponer cambios.');
	}
	const authorized = await hasActiveMcpAuthorization(database, {
		jti: input.jti, subject: input.ownerUserId, clientId: input.clientId,
		requiredScopes: [...MCP_REQUIRED_WRITE_SCOPES], now,
	});
	if (!authorized) throw new McpChangeRequestError('FORBIDDEN_SCOPE', 'La conexión no tiene una autorización vigente para proponer cambios.');
	assertIdempotencyKey(input.idempotencyKey);
	const idempotencyInput = {
		ownerUserId: input.ownerUserId, clientId: input.clientId,
		operation: 'create_transaction', idempotencyKey: input.idempotencyKey,
	};
	const prepared = await prepareTransaction(database, input.ownerUserId, input.draft);
	if ('error' in prepared) throw new McpChangeRequestError('INVALID_PROPOSAL', prepared.error);
	const preview = await buildTransactionProposalPreview(database, input.ownerUserId, prepared.input);
	const payload = { draft: input.draft, prepared: prepared.input };
	return storeChangeProposal(database, {
		...idempotencyInput, payload, preview: preview as unknown as Record<string, unknown>, now,
	});
}

export async function createMcpTransactionUpdateProposal(database: typeof db, input: {
	ownerUserId: string; clientId: string; jti: string; scopes: string[];
	update: UpdateTransactionDraftInput; now?: number;
}) {
	const now = input.now ?? Date.now();
	if (!input.scopes.includes(MCP_TRANSACTION_WRITE_SCOPE) || !input.scopes.includes('finanzar:read')) {
		throw new McpChangeRequestError('FORBIDDEN_SCOPE', 'Esta conexión no tiene permiso para proponer cambios.');
	}
	const authorized = await hasActiveMcpAuthorization(database, {
		jti: input.jti, subject: input.ownerUserId, clientId: input.clientId,
		requiredScopes: [...MCP_REQUIRED_WRITE_SCOPES], now,
	});
	if (!authorized) throw new McpChangeRequestError('FORBIDDEN_SCOPE', 'La conexión no tiene una autorización vigente para proponer cambios.');
	assertIdempotencyKey(input.update.idempotency_key);
	const idempotencyInput = {
		ownerUserId: input.ownerUserId, clientId: input.clientId,
		operation: 'update_transaction', idempotencyKey: input.update.idempotency_key,
	};
	const request = {
		transaction_id: input.update.transaction_id,
		date: input.update.date,
		amount_cents: input.update.amount_cents,
		description: input.update.description.trim(),
		payer_person_id: input.update.payer_person_id,
		payment_method_id: input.update.payment_method_id,
		responsibilities: [...input.update.responsibilities].sort((a, b) => a.person_id.localeCompare(b.person_id)),
		...(input.update.impact_month ? { impact_month: input.update.impact_month } : {}),
	};
	const existing = await findByIdempotencyKey(database, idempotencyInput);
	if (existing) {
		const [proposal] = await database.select().from(ai_change_requests).where(eq(ai_change_requests.id, existing.changeRequestId)).limit(1);
		if (!proposal) throw new McpChangeRequestError('CONFLICT', 'La clave apunta a una propuesta inexistente.');
		const existingPayload = parseProposalPayload(proposal.payload_json);
		if (!existingPayload || !('request' in existingPayload)
			|| canonicalJson(existingPayload.request) !== canonicalJson(request)) {
			throw new McpChangeRequestError('IDEMPOTENCY_CONFLICT', 'La clave ya se usó con otros datos. Usá una clave nueva.');
		}
		return {
			id: proposal.id, state: proposal.state, expires_at: proposal.expires_at,
			preview: JSON.parse(proposal.preview_json) as Record<string, unknown>, reused: true,
		};
	}
	const before = await readEditableTransaction(database, input.ownerUserId, input.update.transaction_id);
	const draft = toTransactionDraft({
		type: before.type, date: input.update.date, amount_cents: input.update.amount_cents,
		description: input.update.description, payer_person_id: input.update.payer_person_id,
		payment_method_id: input.update.payment_method_id,
		responsibilities: input.update.responsibilities, installments_total: 1,
		starting_installment: 1, impact_month: input.update.impact_month ?? before.month,
	});
	const prepared = await prepareTransaction(database, input.ownerUserId, draft);
	if ('error' in prepared) throw new McpChangeRequestError('INVALID_PROPOSAL', prepared.error);
	const beforePayload = versionDraft(before);
	const beforePrepared = await prepareTransaction(database, input.ownerUserId, beforePayload);
	if ('error' in beforePrepared) throw new McpChangeRequestError('CONFLICT', 'El movimiento actual no se puede editar con seguridad.');
	if (canonicalJson(beforePrepared.input) === canonicalJson(prepared.input)) {
		throw new McpChangeRequestError('INVALID_PROPOSAL', 'La propuesta no cambia ningún dato del movimiento.');
	}
	const preview = await buildUpdatePreview(database, before, prepared.input);
	return storeChangeProposal(database, {
		ownerUserId: input.ownerUserId, clientId: input.clientId,
		operation: 'update_transaction', idempotencyKey: input.update.idempotency_key,
		payload: { request, original: before, draft, prepared: prepared.input },
		preview: preview as unknown as Record<string, unknown>, entityVersions: { [before.id]: before }, now,
	});
}

export async function createMcpInstallmentGroupUpdateProposal(database: typeof db, input: {
	ownerUserId: string; clientId: string; jti: string; scopes: string[];
	update: UpdateInstallmentGroupDraftInput; now?: number;
}) {
	const now = input.now ?? Date.now();
	if (input.update.scope !== 'entire_recorded_group') {
		throw new McpChangeRequestError('INVALID_PROPOSAL', 'El alcance de edición de cuotas no es válido.');
	}
	if (!input.scopes.includes(MCP_TRANSACTION_WRITE_SCOPE) || !input.scopes.includes('finanzar:read')) {
		throw new McpChangeRequestError('FORBIDDEN_SCOPE', 'Esta conexión no tiene permiso para proponer cambios.');
	}
	const authorized = await hasActiveMcpAuthorization(database, {
		jti: input.jti, subject: input.ownerUserId, clientId: input.clientId,
		requiredScopes: [...MCP_REQUIRED_WRITE_SCOPES], now,
	});
	if (!authorized) throw new McpChangeRequestError('FORBIDDEN_SCOPE', 'La conexión no tiene una autorización vigente para proponer cambios.');
	assertIdempotencyKey(input.update.idempotency_key);
	const idempotencyInput = {
		ownerUserId: input.ownerUserId, clientId: input.clientId,
		operation: 'update_installment_group', idempotencyKey: input.update.idempotency_key,
	};
	const request = {
		installment_group_id: input.update.installment_group_id,
		purchase_total_cents: input.update.purchase_total_cents,
		description: input.update.description.trim(),
		payer_person_id: input.update.payer_person_id,
		payment_method_id: input.update.payment_method_id,
		responsibilities: [...input.update.responsibilities].sort((a, b) => a.person_id.localeCompare(b.person_id)),
		scope: 'entire_recorded_group',
	};
	const existing = await findByIdempotencyKey(database, idempotencyInput);
	if (existing) {
		const [proposal] = await database.select().from(ai_change_requests).where(eq(ai_change_requests.id, existing.changeRequestId)).limit(1);
		if (!proposal) throw new McpChangeRequestError('CONFLICT', 'La clave apunta a una propuesta inexistente.');
		const existingPayload = parseProposalPayload(proposal.payload_json);
		if (!existingPayload || !('request' in existingPayload)
			|| canonicalJson(existingPayload.request) !== canonicalJson(request)) {
			throw new McpChangeRequestError('IDEMPOTENCY_CONFLICT', 'La clave ya se usó con otros datos. Usá una clave nueva.');
		}
		return {
			id: proposal.id, state: proposal.state, expires_at: proposal.expires_at,
			preview: JSON.parse(proposal.preview_json) as Record<string, unknown>, reused: true,
		};
	}
	const before = await readEditableInstallmentGroup(database, input.ownerUserId, input.update.installment_group_id);
	const first = before.installments[0];
	const draft = toTransactionDraft({
		type: 'expense', date: first.date, amount_cents: input.update.purchase_total_cents,
		description: input.update.description, payer_person_id: input.update.payer_person_id,
		payment_method_id: input.update.payment_method_id,
		responsibilities: input.update.responsibilities, installments_total: before.installments_total,
		starting_installment: first.installment_number, impact_month: before.start_month,
	});
	const prepared = await prepareTransaction(database, input.ownerUserId, draft);
	if ('error' in prepared) throw new McpChangeRequestError('INVALID_PROPOSAL', prepared.error);
	if (prepared.input.schedule.length !== before.installments.length
		|| prepared.input.schedule.some((item, index) => item.installmentNumber !== before.installments[index].installment_number)) {
		throw new McpChangeRequestError('INVALID_PROPOSAL', 'La edición no coincide con todas las cuotas registradas. No se propuso ningún cambio.');
	}
	const originalGroup = {
		id: before.id, description: before.description, total_amount: before.total_amount,
		installments_total: before.installments_total, start_month: before.start_month,
	};
	const preview = await buildInstallmentGroupPreview(database, before, prepared.input, input.update.scope);
	return storeChangeProposal(database, {
		...idempotencyInput,
		payload: { request, draft, prepared: prepared.input, original_group: originalGroup, original_installments: before.installments },
		preview: preview as unknown as Record<string, unknown>,
		entityVersions: { group: originalGroup, installments: before.installments }, now,
	});
}

export async function verifyMcpProposalApprovalConsent(database: typeof db, input: { ownerUserId: string; clientId: string }) {
	return hasActiveMcpConnection(database, {
		subject: input.ownerUserId, clientId: input.clientId, requiredScopes: [...MCP_REQUIRED_WRITE_SCOPES],
	});
}

type ProposalPayload = {
	draft: TransactionDraft;
	prepared: CreateTransactionInput;
	original?: TransactionVersion;
	original_group?: Omit<InstallmentGroupVersion, 'installments'>;
	original_installments?: InstallmentGroupVersion['installments'];
	request?: Record<string, unknown>;
};

function parseProposalPayload(value: string): ProposalPayload | null {
	try {
		const parsed: unknown = JSON.parse(value);
		if (!parsed || typeof parsed !== 'object' || !('draft' in parsed) || !('prepared' in parsed)) return null;
		return parsed as ProposalPayload;
	} catch { return null; }
}

async function appendProposalAudit(tx: FinanzarTransaction, input: {
	ownerUserId: string; proposalId: string; actorType: 'owner' | 'ai_connection' | 'system'; actorId: string | null;
	eventType: string; metadata?: Record<string, unknown>;
}) {
	await tx.insert(ai_audit_events).values({
		owner_user_id: input.ownerUserId, change_request_id: input.proposalId,
		actor_type: input.actorType, actor_id: input.actorId, event_type: input.eventType,
		metadata_json: canonicalJson(input.metadata ?? {}),
	});
}

export async function getMcpChangeRequest(database: typeof db, ownerUserId: string, proposalId: string, clientId?: string) {
	const [proposal] = await database.select().from(ai_change_requests).where(and(
		eq(ai_change_requests.id, proposalId), eq(ai_change_requests.owner_user_id, ownerUserId),
		...(clientId ? [eq(ai_change_requests.client_id, clientId)] : []),
	)).limit(1);
	if (!proposal) return null;
	return {
		id: proposal.id,
		client_id: proposal.client_id,
		operation: proposal.operation,
		state: proposal.state,
		expires_at: proposal.expires_at,
		preview: JSON.parse(proposal.preview_json) as Record<string, unknown>,
		result: proposal.result_json ? JSON.parse(proposal.result_json) as Record<string, unknown> : null,
	};
}

export async function cancelMcpTransactionProposal(database: typeof db, input: {
	ownerUserId: string; clientId: string; jti: string; scopes: string[]; proposalId: string; now?: number;
}) {
	const now = input.now ?? Date.now();
	if (!input.scopes.includes(MCP_TRANSACTION_WRITE_SCOPE) || !input.scopes.includes('finanzar:read')) {
		throw new McpChangeRequestError('FORBIDDEN_SCOPE', 'Esta conexión no tiene permiso para cancelar propuestas.');
	}
	const authorized = await hasActiveMcpAuthorization(database, {
		jti: input.jti, subject: input.ownerUserId, clientId: input.clientId,
		requiredScopes: [...MCP_REQUIRED_WRITE_SCOPES], now,
	});
	if (!authorized) throw new McpChangeRequestError('FORBIDDEN_SCOPE', 'La conexión no tiene autorización vigente para cancelar propuestas.');
	const state = await database.transaction(async (tx) => {
		const [proposal] = await tx.select().from(ai_change_requests).where(and(
			eq(ai_change_requests.id, input.proposalId), eq(ai_change_requests.owner_user_id, input.ownerUserId),
			eq(ai_change_requests.client_id, input.clientId),
		)).limit(1);
		if (!proposal) return 'not_found' as const;
		if (proposal.state !== 'pending') return proposal.state;
		const expired = proposal.expires_at.getTime() <= now;
		const nextState = expired ? 'expired' : 'cancelled';
		const [updated] = await tx.update(ai_change_requests).set({ state: nextState }).where(and(
			eq(ai_change_requests.id, proposal.id), eq(ai_change_requests.state, 'pending'),
		)).returning({ id: ai_change_requests.id });
		if (!updated) {
			const [latest] = await tx.select({ state: ai_change_requests.state }).from(ai_change_requests)
				.where(eq(ai_change_requests.id, proposal.id)).limit(1);
			return latest?.state ?? 'conflict';
		}
		await appendProposalAudit(tx, {
			ownerUserId: input.ownerUserId, proposalId: proposal.id,
			actorType: expired ? 'system' : 'ai_connection', actorId: expired ? null : input.clientId,
			eventType: expired ? 'proposal_expired' : 'proposal_cancelled',
		});
		return nextState;
	});
	if (state === 'not_found') throw new McpChangeRequestError('NOT_FOUND', 'No se encontró una propuesta pendiente de esta conexión.');
	if (state === 'expired') throw new McpChangeRequestError('EXPIRED', 'La propuesta venció y no se aplicó.');
	if (state !== 'cancelled') throw new McpChangeRequestError('CONFLICT', `La propuesta ya no está pendiente (estado: ${state}).`);
	return { proposal_id: input.proposalId, state };
}

export async function decideMcpTransactionProposal(database: typeof db, input: {
	ownerUserId: string; proposalId: string; approvedByUserId: string; now?: number;
	clientId?: string; jti?: string; scopes?: string[]; approvalChannel?: 'web' | 'mcp_chat';
}) {
	const now = input.now ?? Date.now();
	const outcome = await database.transaction(async (tx) => {
		const [proposal] = await tx.select().from(ai_change_requests).where(and(
			eq(ai_change_requests.id, input.proposalId), eq(ai_change_requests.owner_user_id, input.ownerUserId),
		)).limit(1);
		if (!proposal) return { kind: 'not_found' as const };
		if (input.clientId && proposal.client_id !== input.clientId) return { kind: 'not_found' as const };
		if (proposal.state === 'applied') {
			return { kind: 'applied' as const, result: proposal.result_json ? JSON.parse(proposal.result_json) as Record<string, unknown> : {} };
		}
		if (proposal.state !== 'pending') return { kind: 'state' as const, state: proposal.state };
		if (proposal.expires_at.getTime() <= now) {
			await tx.update(ai_change_requests).set({ state: 'expired' }).where(and(
				eq(ai_change_requests.id, proposal.id), eq(ai_change_requests.state, 'pending'),
			));
			await appendProposalAudit(tx, {
				ownerUserId: input.ownerUserId, proposalId: proposal.id, actorType: 'system', actorId: null,
				eventType: 'proposal_expired',
			});
			return { kind: 'expired' as const };
		}

		const authorized = input.clientId
			? Boolean(input.jti && input.scopes?.includes(MCP_TRANSACTION_WRITE_SCOPE)
				&& input.scopes.includes('finanzar:read') && await hasActiveMcpAuthorization(tx as unknown as DatabaseTransaction, {
					jti: input.jti, subject: input.ownerUserId, clientId: input.clientId,
					requiredScopes: [...MCP_REQUIRED_WRITE_SCOPES], now,
				}))
			: await hasActiveMcpConnection(tx as unknown as DatabaseTransaction, {
				subject: input.ownerUserId, clientId: proposal.client_id, requiredScopes: [...MCP_REQUIRED_WRITE_SCOPES],
			});
		if (!authorized) return { kind: 'authorization' as const };
		const payload = parseProposalPayload(proposal.payload_json);
		if (!payload || hashJson({ operation: proposal.operation, payload }) !== proposal.payload_hash) {
			await tx.update(ai_change_requests).set({ state: 'conflict' }).where(and(
				eq(ai_change_requests.id, proposal.id), eq(ai_change_requests.state, 'pending'),
			));
			await appendProposalAudit(tx, {
				ownerUserId: input.ownerUserId, proposalId: proposal.id, actorType: 'system', actorId: null,
				eventType: 'proposal_conflict', metadata: { reason: 'payload_integrity' },
			});
			return { kind: 'conflict' as const };
		}

		const txDb = tx as unknown as typeof db;
		const prepared = await prepareTransaction(txDb, input.ownerUserId, payload.draft);
		if ('error' in prepared
			|| canonicalJson(prepared.input) !== canonicalJson(payload.prepared)) {
			await tx.update(ai_change_requests).set({ state: 'conflict' }).where(and(
				eq(ai_change_requests.id, proposal.id), eq(ai_change_requests.state, 'pending'),
			));
			await appendProposalAudit(tx, {
				ownerUserId: input.ownerUserId, proposalId: proposal.id, actorType: 'system', actorId: null,
				eventType: 'proposal_conflict', metadata: { reason: 'financial_inputs_changed' },
			});
			return { kind: 'conflict' as const };
		}
		let currentPreview: Record<string, unknown>;
		if (proposal.operation === 'update_transaction' && payload.original) {
			const current = await readTransactionVersion(txDb, input.ownerUserId, payload.original.id);
			let savedVersions: unknown;
			try { savedVersions = JSON.parse(proposal.entity_versions_json); } catch { savedVersions = null; }
			if (canonicalJson(current) !== canonicalJson(payload.original)
				|| canonicalJson(savedVersions) !== canonicalJson({ [payload.original.id]: payload.original })) {
				await tx.update(ai_change_requests).set({ state: 'conflict' }).where(and(
					eq(ai_change_requests.id, proposal.id), eq(ai_change_requests.state, 'pending'),
				));
				await appendProposalAudit(tx, {
					ownerUserId: input.ownerUserId, proposalId: proposal.id, actorType: 'system', actorId: null,
					eventType: 'proposal_conflict', metadata: { reason: 'transaction_changed_since_proposal' },
				});
				return { kind: 'conflict' as const };
			}
			currentPreview = await buildUpdatePreview(txDb, current, prepared.input) as unknown as Record<string, unknown>;
		} else if (proposal.operation === 'update_installment_group' && payload.original_group && payload.original_installments
			&& payload.request?.scope === 'entire_recorded_group') {
			const current = await readEditableInstallmentGroup(txDb, input.ownerUserId, payload.original_group.id);
			const original = { ...payload.original_group, installments: payload.original_installments };
			let savedVersions: unknown;
			try { savedVersions = JSON.parse(proposal.entity_versions_json); } catch { savedVersions = null; }
			if (canonicalJson(current) !== canonicalJson(original)
				|| canonicalJson(savedVersions) !== canonicalJson({ group: payload.original_group, installments: payload.original_installments })) {
				await tx.update(ai_change_requests).set({ state: 'conflict' }).where(and(
					eq(ai_change_requests.id, proposal.id), eq(ai_change_requests.state, 'pending'),
				));
				await appendProposalAudit(tx, {
					ownerUserId: input.ownerUserId, proposalId: proposal.id, actorType: 'system', actorId: null,
					eventType: 'proposal_conflict', metadata: { reason: 'installment_group_changed_since_proposal' },
				});
				return { kind: 'conflict' as const };
			}
			currentPreview = await buildInstallmentGroupPreview(txDb, current, prepared.input, 'entire_recorded_group') as unknown as Record<string, unknown>;
		} else if (proposal.operation === 'create_transaction' && !payload.original) {
			currentPreview = await buildTransactionProposalPreview(txDb, input.ownerUserId, prepared.input) as unknown as Record<string, unknown>;
		} else {
			await tx.update(ai_change_requests).set({ state: 'conflict' }).where(and(
				eq(ai_change_requests.id, proposal.id), eq(ai_change_requests.state, 'pending'),
			));
			await appendProposalAudit(tx, {
				ownerUserId: input.ownerUserId, proposalId: proposal.id, actorType: 'system', actorId: null,
				eventType: 'proposal_conflict', metadata: { reason: 'unsupported_operation' },
			});
			return { kind: 'conflict' as const };
		}
		if (canonicalJson(currentPreview) !== proposal.preview_json) {
			await tx.update(ai_change_requests).set({ state: 'conflict' }).where(and(
				eq(ai_change_requests.id, proposal.id), eq(ai_change_requests.state, 'pending'),
			));
			await appendProposalAudit(tx, {
				ownerUserId: input.ownerUserId, proposalId: proposal.id, actorType: 'system', actorId: null,
				eventType: 'proposal_conflict', metadata: { reason: 'preview_changed' },
			});
			return { kind: 'conflict' as const };
		}

		const [claimed] = await tx.update(ai_change_requests).set({
			state: 'applied', approved_at: new Date(now), approved_by_user_id: input.approvedByUserId,
		}).where(and(
			eq(ai_change_requests.id, proposal.id), eq(ai_change_requests.owner_user_id, input.ownerUserId),
			eq(ai_change_requests.state, 'pending'),
		)).returning({ id: ai_change_requests.id });
		if (!claimed) {
			const [latest] = await tx.select().from(ai_change_requests).where(eq(ai_change_requests.id, proposal.id)).limit(1);
			if (latest?.state === 'applied') return { kind: 'applied' as const, result: latest.result_json ? JSON.parse(latest.result_json) as Record<string, unknown> : {} };
			return { kind: 'state' as const, state: latest?.state ?? 'conflict' };
		}

		if (proposal.operation === 'update_transaction') {
			const original = payload.original;
			if (!original) throw new McpChangeRequestError('CONFLICT', 'La propuesta no contiene la versión original del movimiento.');
			const [updated] = await tx.update(transactions).set({
				date: prepared.input.date,
				month: prepared.input.billingMonth,
				amount: prepared.input.amountCents,
				description: prepared.input.description,
				payer_person_id: prepared.input.payerPersonId,
				payment_method_id: prepared.input.paymentMethodId,
				card_id: prepared.input.cardId,
				updated_at: sql`CURRENT_TIMESTAMP`,
			}).where(and(
				eq(transactions.id, original.id), eq(transactions.status, 'active'),
				eq(transactions.updated_at, original.updated_at),
				eq(transactions.date, original.date), eq(transactions.month, original.month),
				eq(transactions.amount, original.amount), eq(transactions.description, original.description),
				eq(transactions.payer_person_id, original.payer_person_id),
				eq(transactions.payment_method_id, original.payment_method_id),
				original.card_id ? eq(transactions.card_id, original.card_id) : isNull(transactions.card_id),
				isNull(transactions.installment_group_id), isNull(transactions.recurring_rule_id),
			)).returning({ id: transactions.id });
			if (!updated) {
				await tx.update(ai_change_requests).set({ state: 'conflict' }).where(eq(ai_change_requests.id, proposal.id));
				await appendProposalAudit(tx, {
					ownerUserId: input.ownerUserId, proposalId: proposal.id, actorType: 'system', actorId: null,
					eventType: 'proposal_conflict', metadata: { reason: 'transaction_compare_and_swap_failed' },
				});
				return { kind: 'conflict' as const };
			}
			await tx.delete(transaction_splits).where(eq(transaction_splits.transaction_id, original.id));
			await tx.insert(transaction_splits).values(prepared.input.splits.map((split) => ({
				transaction_id: original.id, person_id: split.person_id, amount: split.amount,
			})));
			const result = { transaction_ids: [original.id], installment_group_id: null, updated: true, updated_at: now };
			await tx.update(ai_change_requests).set({ result_json: canonicalJson(result) }).where(eq(ai_change_requests.id, proposal.id));
			await appendProposalAudit(tx, {
			ownerUserId: input.ownerUserId, proposalId: proposal.id,
			actorType: input.approvalChannel === 'mcp_chat' ? 'ai_connection' : 'owner',
			actorId: input.approvalChannel === 'mcp_chat' ? input.clientId ?? null : input.approvedByUserId,
			eventType: 'proposal_applied', metadata: {
				updated: true, transaction_id: original.id, payload_hash: proposal.payload_hash,
				...(input.approvalChannel ? { approval_channel: input.approvalChannel } : {}),
				...(input.clientId ? { client_id: input.clientId } : {}),
			},
			});
			return { kind: 'applied' as const, result };
		}
		if (proposal.operation === 'update_installment_group') {
			const originalGroup = payload.original_group;
			const originalInstallments = payload.original_installments;
			if (!originalGroup || !originalInstallments || originalInstallments.length !== prepared.input.schedule.length) {
				throw new McpChangeRequestError('CONFLICT', 'La propuesta no contiene el snapshot completo de la serie.');
			}
			const [groupUpdated] = await tx.update(installment_groups).set({
				description: prepared.input.description,
				total_amount: prepared.input.amountCents,
			}).where(and(
				eq(installment_groups.id, originalGroup.id),
				eq(installment_groups.description, originalGroup.description),
				eq(installment_groups.total_amount, originalGroup.total_amount),
				eq(installment_groups.installments_total, originalGroup.installments_total),
				eq(installment_groups.start_month, originalGroup.start_month),
			)).returning({ id: installment_groups.id });
			if (!groupUpdated) throw new McpChangeRequestError('CONFLICT', 'La serie cambió mientras se aplicaba la propuesta. No se guardó ningún cambio.');
			for (const [index, scheduled] of prepared.input.schedule.entries()) {
				const original = originalInstallments[index];
				const [updated] = await tx.update(transactions).set({
					date: scheduled.date, month: scheduled.month, amount: scheduled.amount,
					description: `${prepared.input.description} (Cuota ${scheduled.installmentNumber}/${prepared.input.installmentsTotal})`,
					payer_person_id: prepared.input.payerPersonId,
					payment_method_id: prepared.input.paymentMethodId, card_id: prepared.input.cardId,
					updated_at: sql`CURRENT_TIMESTAMP`,
				}).where(and(
					eq(transactions.id, original.id), eq(transactions.updated_at, original.updated_at),
					eq(transactions.installment_group_id, originalGroup.id), eq(transactions.status, 'active'),
				)).returning({ id: transactions.id });
				if (!updated) throw new McpChangeRequestError('CONFLICT', 'Una cuota cambió mientras se aplicaba la propuesta. Se revirtió la operación completa.');
				await tx.delete(transaction_splits).where(eq(transaction_splits.transaction_id, original.id));
				await tx.insert(transaction_splits).values(scheduled.splits.map((split) => ({
					transaction_id: original.id, person_id: split.person_id, amount: split.amount,
				})));
			}
			const result = {
				transaction_ids: originalInstallments.map((item) => item.id),
				installment_group_id: originalGroup.id, updated: true,
				purchase_total_cents: prepared.input.amountCents, installments_updated: prepared.input.schedule.length, updated_at: now,
			};
			await tx.update(ai_change_requests).set({ result_json: canonicalJson(result) }).where(eq(ai_change_requests.id, proposal.id));
			await appendProposalAudit(tx, {
				ownerUserId: input.ownerUserId, proposalId: proposal.id,
				actorType: input.approvalChannel === 'mcp_chat' ? 'ai_connection' : 'owner',
				actorId: input.approvalChannel === 'mcp_chat' ? input.clientId ?? null : input.approvedByUserId,
				eventType: 'proposal_applied', metadata: {
					updated: true, scope: 'entire_recorded_group', installment_group_id: originalGroup.id,
					transaction_count: originalInstallments.length, payload_hash: proposal.payload_hash,
					...(input.approvalChannel ? { approval_channel: input.approvalChannel } : {}),
					...(input.clientId ? { client_id: input.clientId } : {}),
				},
			});
			return { kind: 'applied' as const, result };
		}
		if (proposal.operation !== 'create_transaction' || payload.original) {
			await tx.update(ai_change_requests).set({ state: 'conflict' }).where(eq(ai_change_requests.id, proposal.id));
			await appendProposalAudit(tx, {
				ownerUserId: input.ownerUserId, proposalId: proposal.id, actorType: 'system', actorId: null,
				eventType: 'proposal_conflict', metadata: { reason: 'unsupported_operation' },
			});
			return { kind: 'conflict' as const };
		}

		const persisted = await persistTransactionInTransaction(tx, input.ownerUserId, prepared.input);
		const result = {
			transaction_ids: persisted.transactionIds,
			installment_group_id: persisted.installmentGroupId,
			created_at: now,
		};
		await tx.update(ai_change_requests).set({ result_json: canonicalJson(result) }).where(eq(ai_change_requests.id, proposal.id));
		await appendProposalAudit(tx, {
			ownerUserId: input.ownerUserId, proposalId: proposal.id,
			actorType: input.approvalChannel === 'mcp_chat' ? 'ai_connection' : 'owner',
			actorId: input.approvalChannel === 'mcp_chat' ? input.clientId ?? null : input.approvedByUserId,
			eventType: 'proposal_applied', metadata: {
				transaction_count: persisted.transactionIds.length, payload_hash: proposal.payload_hash,
				...(input.approvalChannel ? { approval_channel: input.approvalChannel } : {}),
				...(input.clientId ? { client_id: input.clientId } : {}),
			},
		});
		return { kind: 'applied' as const, result };
	});

	if (outcome.kind === 'not_found') throw new McpChangeRequestError('NOT_FOUND', 'No se encontró la propuesta solicitada.');
	if (outcome.kind === 'expired') throw new McpChangeRequestError('EXPIRED', 'La propuesta venció; generá una nueva para aplicar el cambio.');
	if (outcome.kind === 'authorization') throw new McpChangeRequestError('FORBIDDEN_SCOPE', 'La conexión que creó la propuesta fue revocada o ya no tiene permiso de escritura.');
	if (outcome.kind === 'conflict') throw new McpChangeRequestError('CONFLICT', 'Los datos o referencias cambiaron desde la propuesta. No se aplicó ningún movimiento; generá una nueva.');
	if (outcome.kind === 'state') throw new McpChangeRequestError('CONFLICT', `La propuesta ya no está pendiente (estado: ${outcome.state}).`);
	return outcome.result;
}

export async function rejectMcpTransactionProposal(database: typeof db, input: {
	ownerUserId: string; proposalId: string; rejectedByUserId: string; now?: number;
}) {
	const now = input.now ?? Date.now();
	const outcome = await database.transaction(async (tx) => {
		const [proposal] = await tx.select().from(ai_change_requests).where(and(
			eq(ai_change_requests.id, input.proposalId), eq(ai_change_requests.owner_user_id, input.ownerUserId),
		)).limit(1);
		if (!proposal) return 'not_found' as const;
		if (proposal.state !== 'pending') return proposal.state;
		const expired = proposal.expires_at.getTime() <= now;
		await tx.update(ai_change_requests).set({ state: expired ? 'expired' : 'rejected' }).where(and(
			eq(ai_change_requests.id, proposal.id), eq(ai_change_requests.state, 'pending'),
		));
		await appendProposalAudit(tx, {
			ownerUserId: input.ownerUserId, proposalId: proposal.id,
			actorType: expired ? 'system' : 'owner', actorId: expired ? null : input.rejectedByUserId,
			eventType: expired ? 'proposal_expired' : 'proposal_rejected',
		});
		return expired ? 'expired' as const : 'rejected' as const;
	});
	if (outcome === 'not_found') throw new McpChangeRequestError('NOT_FOUND', 'No se encontró la propuesta solicitada.');
	if (outcome === 'expired') throw new McpChangeRequestError('EXPIRED', 'La propuesta ya venció.');
	if (outcome !== 'rejected') throw new McpChangeRequestError('CONFLICT', `La propuesta ya no está pendiente (estado: ${outcome}).`);
	return { state: outcome };
}
