import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { eq } from 'drizzle-orm';
import * as appSchema from '@/db/schema';
import * as authSchema from '@/db/auth-schema';
import { createMcpInstallmentGroupUpdateProposal, createMcpTransactionUpdateProposal, decideMcpTransactionProposal, McpChangeRequestError } from './mcp-change-requests';

const schema = { ...appSchema, ...authSchema };
const scopes = ['finanzar:read', 'finanzar:transactions:write'];

async function fixture() {
	const client = createClient({ url: 'file::memory:' });
	for (const name of [
		'0000_fluffy_diamondback.sql', '0001_seed_owner.sql', '0002_abnormal_chronomancer.sql',
		'0003_sad_grey_gargoyle.sql', '0004_auth_accounts.sql', '0005_mcp_oauth.sql',
	]) await client.executeMultiple(await readFile(new URL(`../../drizzle/${name}`, import.meta.url), 'utf8'));
	const database = drizzle(client, { schema });
	await database.insert(authSchema.user).values({ id: 'update-owner', name: 'Owner', email: 'update-owner@example.invalid' });
	await client.executeMultiple(await readFile(new URL('../../drizzle/0006_private_ledger_owner.sql', import.meta.url), 'utf8'));
	await client.executeMultiple(await readFile(new URL('../../drizzle/0007_mcp_access_grants.sql', import.meta.url), 'utf8'));
	await client.executeMultiple(await readFile(new URL('../../drizzle/0008_sour_bloodstrike.sql', import.meta.url), 'utf8'));
	const now = new Date();
	await database.insert(authSchema.oauthClient).values({ id: 'update-client-row', clientId: 'update-client', name: 'Test client', redirectUris: [] });
	await database.insert(authSchema.oauthConsent).values({
		id: 'update-consent', clientId: 'update-client', userId: 'update-owner', scopes,
		createdAt: now, updatedAt: now,
	});
	await database.insert(appSchema.mcp_access_grants).values({
		jti: 'update-grant', owner_user_id: 'update-owner', client_id: 'update-client',
		issued_at: now, expires_at: new Date(now.getTime() + 60 * 60_000),
	});
	await database.insert(appSchema.people).values({ id: 'update-leo', name: 'Leo' });
	await database.insert(appSchema.payment_methods).values({ id: 'update-cash', name: 'Efectivo', type: 'cash' });
	await database.insert(appSchema.transactions).values({
		id: 'update-transaction', date: '2026-10-10', month: '2026-10', type: 'expense', amount: 10_000,
		description: 'Compra original', payer_person_id: 'owner_1', payment_method_id: 'update-cash', status: 'active',
	});
	await database.insert(appSchema.transaction_splits).values({
		id: 'update-owner-split', transaction_id: 'update-transaction', person_id: 'owner_1', amount: 10_000,
	});
	const proposeUpdate = (input: {
		key: string; transactionId: string; amount: number; description?: string;
		responsibilities?: Array<{ person_id: string; amount_cents: number }>;
	}) => createMcpTransactionUpdateProposal(database, {
		ownerUserId: 'update-owner', clientId: 'update-client', jti: 'update-grant', scopes,
		update: {
			idempotency_key: input.key, transaction_id: input.transactionId, date: '2026-10-10',
			amount_cents: input.amount, description: input.description ?? 'Compra corregida',
			payer_person_id: 'owner_1', payment_method_id: 'update-cash',
			responsibilities: input.responsibilities ?? [{ person_id: 'owner_1', amount_cents: input.amount }],
		},
	});
	return { client, database, proposeUpdate };
}

test('MCP update proposes a before/after diff, applies atomically only after approval, and retries idempotently', async () => {
	const f = await fixture();
	try {
		const proposal = await f.proposeUpdate({
			key: 'update-test-key-1', transactionId: 'update-transaction', amount: 15_500,
			responsibilities: [
				{ person_id: 'owner_1', amount_cents: 10_000 },
				{ person_id: 'update-leo', amount_cents: 5_500 },
			],
		});
		assert.equal(proposal.state, 'pending');
		const preview = proposal.preview as { kind: string; before: { amount_cents: number }; after: { amount_cents: number } };
		assert.equal(preview.kind, 'update_transaction');
		assert.equal(preview.before.amount_cents, 10_000);
		assert.equal(preview.after.amount_cents, 15_500);
		assert.equal((await f.database.select().from(appSchema.transactions)).length, 1);
		assert.equal((await f.database.select().from(appSchema.transaction_splits)).length, 1);
		assert.equal((await f.database.select().from(appSchema.transactions))[0].amount, 10_000);

		await assert.rejects(
			decideMcpTransactionProposal(f.database, {
				ownerUserId: 'update-owner', approvedByUserId: 'update-owner', proposalId: proposal.id,
				clientId: 'another-client', jti: 'update-grant', scopes, approvalChannel: 'mcp_chat',
			}),
			(error: unknown) => error instanceof McpChangeRequestError && error.code === 'NOT_FOUND',
			'a different MCP client must not apply this proposal',
		);
		const decision = {
			ownerUserId: 'update-owner', approvedByUserId: 'update-owner', proposalId: proposal.id,
			clientId: 'update-client', jti: 'update-grant', scopes, approvalChannel: 'mcp_chat' as const,
		};
		const result = await decideMcpTransactionProposal(f.database, decision);
		assert.equal('updated' in result && result.updated === true, true);
		assert.deepEqual(result.transaction_ids, ['update-transaction']);
		const [updated] = await f.database.select().from(appSchema.transactions).where(eq(appSchema.transactions.id, 'update-transaction'));
		assert.equal(updated.amount, 15_500);
		assert.equal(updated.description, 'Compra corregida');
		assert.deepEqual(
			(await f.database.select({ person_id: appSchema.transaction_splits.person_id, amount: appSchema.transaction_splits.amount })
				.from(appSchema.transaction_splits).where(eq(appSchema.transaction_splits.transaction_id, 'update-transaction')))
				.sort((a, b) => a.person_id.localeCompare(b.person_id)),
			[
				{ person_id: 'owner_1', amount: 10_000 },
				{ person_id: 'update-leo', amount: 5_500 },
			].sort((a, b) => a.person_id.localeCompare(b.person_id)),
		);
		assert.deepEqual(await decideMcpTransactionProposal(f.database, decision), result);
		assert.equal((await f.database.select().from(appSchema.transactions)).length, 1);
		assert.equal((await f.database.select().from(appSchema.ai_audit_events)
			.where(eq(appSchema.ai_audit_events.event_type, 'proposal_applied'))).length, 1);
		const [audit] = await f.database.select().from(appSchema.ai_audit_events)
			.where(eq(appSchema.ai_audit_events.event_type, 'proposal_applied'));
		assert.equal(audit.actor_type, 'ai_connection');
		assert.match(audit.metadata_json, /mcp_chat/);
		await assert.rejects(
			f.proposeUpdate({ key: 'update-test-key-1', transactionId: 'update-transaction', amount: 16_000 }),
			(error: unknown) => error instanceof McpChangeRequestError && error.code === 'IDEMPOTENCY_CONFLICT',
		);
	} finally { f.client.close(); }
});

test('MCP update refuses installment and recurring rows and does not overwrite a stale proposal', async () => {
	const f = await fixture();
	try {
		await f.database.insert(appSchema.installment_groups).values({
			id: 'update-group', description: 'Cuotas', total_amount: 30_000, installments_total: 3, start_month: '2026-10',
		});
		await f.database.insert(appSchema.transactions).values({
			id: 'update-installment', date: '2026-10-10', month: '2026-10', type: 'expense', amount: 10_000,
			description: 'Compra (Cuota 1/3)', payer_person_id: 'owner_1', payment_method_id: 'update-cash',
			installment_group_id: 'update-group', status: 'active',
		});
		await f.database.insert(appSchema.recurring_rules).values({
			id: 'update-rule', description: 'Regla mensual', amount: 10_000, type: 'expense',
			payer_person_id: 'owner_1', payment_method_id: 'update-cash', day_of_month: 10,
		});
		await f.database.insert(appSchema.transactions).values({
			id: 'update-recurring', date: '2026-10-10', month: '2026-10', type: 'expense', amount: 10_000,
			description: 'Regla mensual', payer_person_id: 'owner_1', payment_method_id: 'update-cash',
			recurring_rule_id: 'update-rule', status: 'active',
		});
		await assert.rejects(
			f.proposeUpdate({ key: 'update-installment-key', transactionId: 'update-installment', amount: 12_000 }),
			(error: unknown) => error instanceof McpChangeRequestError && error.code === 'INVALID_PROPOSAL',
		);
		await assert.rejects(
			f.proposeUpdate({ key: 'update-recurring-key', transactionId: 'update-recurring', amount: 12_000 }),
			(error: unknown) => error instanceof McpChangeRequestError && error.code === 'INVALID_PROPOSAL',
		);

		const proposal = await f.proposeUpdate({ key: 'update-stale-key-1', transactionId: 'update-transaction', amount: 12_000 });
		await f.database.update(appSchema.transactions).set({ amount: 11_000, updated_at: '2026-10-10 12:00:00' })
			.where(eq(appSchema.transactions.id, 'update-transaction'));
		await assert.rejects(
			decideMcpTransactionProposal(f.database, {
				ownerUserId: 'update-owner', approvedByUserId: 'update-owner', proposalId: proposal.id,
			}),
			(error: unknown) => error instanceof McpChangeRequestError && error.code === 'CONFLICT',
		);
		const [latest] = await f.database.select().from(appSchema.transactions)
			.where(eq(appSchema.transactions.id, 'update-transaction'));
		assert.equal(latest.amount, 11_000);
		const [request] = await f.database.select().from(appSchema.ai_change_requests)
			.where(eq(appSchema.ai_change_requests.id, proposal.id));
		assert.equal(request.state, 'conflict');
		assert.equal((await f.database.select().from(appSchema.ai_audit_events)
			.where(eq(appSchema.ai_audit_events.event_type, 'proposal_conflict'))).length, 1);
	} finally { f.client.close(); }
});

test('MCP installment-group update previews and atomically applies full total, future installments, splits and card reassignment', async () => {
	const f = await fixture();
	try {
		await f.database.insert(appSchema.cards).values({
			id: 'update-icbc', name: 'ICBC', owner_person_id: 'owner_1', closing_day: 24, due_day: 6,
		});
		await f.database.insert(appSchema.payment_methods).values({
			id: 'update-icbc-method', name: 'ICBC', type: 'credit_card', card_id: 'update-icbc',
		});
		await f.database.insert(appSchema.installment_groups).values({
			id: 'update-series', description: 'Compra cuotas', total_amount: 60_000, installments_total: 3, start_month: '2026-10',
		});
		for (let number = 1; number <= 3; number++) {
			const month = `2026-${String(9 + number).padStart(2, '0')}`;
			const id = `update-series-${number}`;
			await f.database.insert(appSchema.transactions).values({
				id, date: `${month}-10`, month, type: 'expense', amount: 20_000,
				description: `Compra cuotas (Cuota ${number}/3)`, payer_person_id: 'owner_1',
				payment_method_id: 'update-cash', installment_group_id: 'update-series', status: 'active',
			});
			await f.database.insert(appSchema.transaction_splits).values({
				id: `${id}-split`, transaction_id: id, person_id: 'owner_1', amount: 20_000,
			});
		}
		const propose = () => createMcpInstallmentGroupUpdateProposal(f.database, {
			ownerUserId: 'update-owner', clientId: 'update-client', jti: 'update-grant', scopes,
			update: {
				idempotency_key: 'update-series-key-1', installment_group_id: 'update-series',
				purchase_total_cents: 75_001, description: 'Compra corregida', payer_person_id: 'owner_1',
				payment_method_id: 'update-icbc-method', scope: 'entire_recorded_group',
				responsibilities: [
					{ person_id: 'owner_1', amount_cents: 50_000 },
					{ person_id: 'update-leo', amount_cents: 25_001 },
				],
			},
		});
		const proposal = await propose();
		assert.equal(proposal.state, 'pending');
		const preview = proposal.preview as {
			scope: string; before: { purchase_total_cents: number; installments: Array<{ amount_cents: number }> };
			after: { purchase_total_cents: number; payment_method: { id: string }; card: { id: string } | null; installments: Array<{ amount_cents: number; date: string; responsibilities: Array<{ id: string; amount_cents: number }> }> };
		};
		assert.equal(preview.scope, 'entire_recorded_group');
		assert.equal(preview.before.purchase_total_cents, 60_000);
		assert.equal(preview.after.purchase_total_cents, 75_001);
		assert.deepEqual(preview.after.installments.map((item) => item.amount_cents), [24_999, 25_001, 25_001]);
		assert.equal(preview.after.payment_method.id, 'update-icbc-method');
		assert.equal(preview.after.card?.id, 'update-icbc');
		assert.deepEqual(preview.after.installments.map((item) => item.date), ['2026-10-06', '2026-11-06', '2026-12-06']);
		assert.equal((await f.database.select().from(appSchema.installment_groups))[0].total_amount, 60_000);
		assert.equal((await f.database.select().from(appSchema.transactions).where(eq(appSchema.transactions.installment_group_id, 'update-series'))).every((row) => row.amount === 20_000), true);

		const decision = {
			ownerUserId: 'update-owner', approvedByUserId: 'update-owner', proposalId: proposal.id,
			clientId: 'update-client', jti: 'update-grant', scopes, approvalChannel: 'mcp_chat' as const,
		};
		const result = await decideMcpTransactionProposal(f.database, decision);
		assert.equal('updated' in result && result.updated === true, true);
		const [group] = await f.database.select().from(appSchema.installment_groups).where(eq(appSchema.installment_groups.id, 'update-series'));
		assert.equal(group.total_amount, 75_001);
		assert.equal(group.description, 'Compra corregida');
		const rows = await f.database.select().from(appSchema.transactions).where(eq(appSchema.transactions.installment_group_id, 'update-series'));
		assert.deepEqual(rows.sort((a, b) => a.date.localeCompare(b.date)).map((row) => ({
			amount: row.amount, date: row.date, month: row.month, payment: row.payment_method_id,
			card: row.card_id, description: row.description,
		})), [
			{ amount: 24_999, date: '2026-10-06', month: '2026-10', payment: 'update-icbc-method', card: 'update-icbc', description: 'Compra corregida (Cuota 1/3)' },
			{ amount: 25_001, date: '2026-11-06', month: '2026-11', payment: 'update-icbc-method', card: 'update-icbc', description: 'Compra corregida (Cuota 2/3)' },
			{ amount: 25_001, date: '2026-12-06', month: '2026-12', payment: 'update-icbc-method', card: 'update-icbc', description: 'Compra corregida (Cuota 3/3)' },
		]);
		assert.equal((await f.database.select().from(appSchema.transaction_splits)
			.where(eq(appSchema.transaction_splits.transaction_id, 'update-series-1'))).reduce((sum, split) => sum + split.amount, 0), 24_999);
		assert.deepEqual(await decideMcpTransactionProposal(f.database, decision), result);
		assert.equal((await f.database.select().from(appSchema.ai_audit_events)
			.where(eq(appSchema.ai_audit_events.event_type, 'proposal_applied'))).length, 1);
		assert.equal((await propose()).reused, true);
	} finally { f.client.close(); }
});

test('MCP installment-group update rejects incomplete series and turns stale approvals into conflicts without partial writes', async () => {
	const f = await fixture();
	try {
		await f.database.insert(appSchema.cards).values({
			id: 'update-icbc', name: 'ICBC', owner_person_id: 'owner_1', closing_day: 24, due_day: 6,
		});
		await f.database.insert(appSchema.payment_methods).values({
			id: 'update-icbc-method', name: 'ICBC', type: 'credit_card', card_id: 'update-icbc',
		});
		await f.database.insert(appSchema.installment_groups).values({
			id: 'update-series', description: 'Compra cuotas', total_amount: 60_000, installments_total: 3, start_month: '2026-10',
		});
		for (const number of [1, 3]) {
			const month = number === 1 ? '2026-10' : '2026-12';
			const id = `update-series-${number}`;
			await f.database.insert(appSchema.transactions).values({
				id, date: `${month}-10`, month, type: 'expense', amount: 20_000,
				description: `Compra cuotas (Cuota ${number}/3)`, payer_person_id: 'owner_1',
				payment_method_id: 'update-cash', installment_group_id: 'update-series', status: 'active',
			});
			await f.database.insert(appSchema.transaction_splits).values({ id: `${id}-split`, transaction_id: id, person_id: 'owner_1', amount: 20_000 });
		}
		const update = {
			idempotency_key: 'update-series-key-2', installment_group_id: 'update-series',
			purchase_total_cents: 75_000, description: 'Compra corregida', payer_person_id: 'owner_1',
			payment_method_id: 'update-icbc-method', scope: 'entire_recorded_group' as const,
			responsibilities: [{ person_id: 'owner_1', amount_cents: 75_000 }],
		};
		await assert.rejects(
			createMcpInstallmentGroupUpdateProposal(f.database, { ownerUserId: 'update-owner', clientId: 'update-client', jti: 'update-grant', scopes, update }),
			(error: unknown) => error instanceof McpChangeRequestError && error.code === 'INVALID_PROPOSAL',
		);

		await f.database.insert(appSchema.transactions).values({
			id: 'update-series-2', date: '2026-11-10', month: '2026-11', type: 'expense', amount: 20_000,
			description: 'Compra cuotas (Cuota 2/3)', payer_person_id: 'owner_1', payment_method_id: 'update-cash',
			installment_group_id: 'update-series', status: 'active',
		});
		await f.database.insert(appSchema.transaction_splits).values({ id: 'update-series-2-split', transaction_id: 'update-series-2', person_id: 'owner_1', amount: 20_000 });
		const proposal = await createMcpInstallmentGroupUpdateProposal(f.database, {
			ownerUserId: 'update-owner', clientId: 'update-client', jti: 'update-grant', scopes,
			update: { ...update, idempotency_key: 'update-series-key-3' },
		});
		await f.database.update(appSchema.transactions).set({ amount: 21_000, updated_at: '2026-10-10 12:00:00' })
			.where(eq(appSchema.transactions.id, 'update-series-2'));
		await assert.rejects(
			decideMcpTransactionProposal(f.database, { ownerUserId: 'update-owner', approvedByUserId: 'update-owner', proposalId: proposal.id, clientId: 'update-client', jti: 'update-grant', scopes, approvalChannel: 'mcp_chat' }),
			(error: unknown) => error instanceof McpChangeRequestError && error.code === 'CONFLICT',
		);
		const [group] = await f.database.select().from(appSchema.installment_groups).where(eq(appSchema.installment_groups.id, 'update-series'));
		assert.equal(group.total_amount, 60_000);
		assert.equal((await f.database.select().from(appSchema.transactions).where(eq(appSchema.transactions.installment_group_id, 'update-series')))
			.find((row) => row.id === 'update-series-1')?.amount, 20_000);
		assert.equal((await f.database.select().from(appSchema.transactions).where(eq(appSchema.transactions.installment_group_id, 'update-series')))
			.find((row) => row.id === 'update-series-2')?.amount, 21_000);
	} finally { f.client.close(); }
});
