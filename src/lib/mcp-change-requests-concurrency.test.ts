import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { eq } from 'drizzle-orm';
import * as appSchema from '../db/schema';
import * as authSchema from '../db/auth-schema';
import { createMcpInstallmentGroupUpdateProposal, createMcpTransactionProposal, createMcpTransactionUpdateProposal, decideMcpTransactionProposal, toTransactionDraft } from './mcp-change-requests';

const schema = { ...appSchema, ...authSchema };

test('two independent DB clients cannot apply the same pending proposal twice', async () => {
	const directory = await mkdtemp(join(tmpdir(), 'finanzar-mcp-race-'));
	const dbPath = join(directory, 'test.db');
	const url = `file:${dbPath}`;
	const clientA = createClient({ url });
	let clientB: ReturnType<typeof createClient> | undefined;
	let clientAClosed = false;
	try {
		for (const name of [
			'0000_fluffy_diamondback.sql', '0001_seed_owner.sql', '0002_abnormal_chronomancer.sql',
			'0003_sad_grey_gargoyle.sql', '0004_auth_accounts.sql', '0005_mcp_oauth.sql',
		]) {
			await clientA.executeMultiple(await readFile(new URL(`../../drizzle/${name}`, import.meta.url), 'utf8'));
		}
		const databaseA = drizzle(clientA, { schema });
		await databaseA.insert(authSchema.user).values({ id: 'race-owner', name: 'Owner', email: 'race-owner@example.invalid' });
		await clientA.executeMultiple(await readFile(new URL('../../drizzle/0006_private_ledger_owner.sql', import.meta.url), 'utf8'));
		await clientA.executeMultiple(await readFile(new URL('../../drizzle/0007_mcp_access_grants.sql', import.meta.url), 'utf8'));
		await clientA.executeMultiple(await readFile(new URL('../../drizzle/0008_sour_bloodstrike.sql', import.meta.url), 'utf8'));
		const now = Date.now();
		await databaseA.insert(authSchema.oauthClient).values({
			id: 'race-client-row', clientId: 'https://race.example/client.json', name: 'Race client',
			redirectUris: ['https://race.example/callback'], disabled: false,
		});
		await databaseA.insert(authSchema.oauthConsent).values({
			id: 'race-consent', clientId: 'https://race.example/client.json', userId: 'race-owner',
			createdAt: new Date(now), updatedAt: new Date(now), scopes: ['finanzar:read', 'finanzar:transactions:write'],
		});
		await databaseA.insert(appSchema.mcp_access_grants).values({
			jti: 'race-jti', owner_user_id: 'race-owner', client_id: 'https://race.example/client.json',
			issued_at: new Date(now), expires_at: new Date(now + 60_000),
		});
		await databaseA.insert(appSchema.payment_methods).values({ id: 'race-cash', name: 'Efectivo', type: 'cash' });
		clientB = createClient({ url });
		const databaseB = drizzle(clientB, { schema });
		const proposal = await createMcpTransactionProposal(databaseA, {
			ownerUserId: 'race-owner', clientId: 'https://race.example/client.json', jti: 'race-jti',
			scopes: ['finanzar:read', 'finanzar:transactions:write'], idempotencyKey: 'race-proposal-key-1',
			draft: toTransactionDraft({
				type: 'expense', date: '2026-10-09', amount_cents: 12_345, description: 'Race test',
				payer_person_id: 'owner_1', payment_method_id: 'race-cash',
				responsibilities: [{ person_id: 'owner_1', amount_cents: 12_345 }], installments_total: 1, starting_installment: 1,
			}), now,
		});
		const decision = { ownerUserId: 'race-owner', approvedByUserId: 'race-owner', proposalId: proposal.id };
		const decisions = await Promise.allSettled([
			decideMcpTransactionProposal(databaseA, decision),
			decideMcpTransactionProposal(databaseB, decision),
		]);
		const firstSuccess = decisions.find((result) => result.status === 'fulfilled');
		assert.ok(firstSuccess && firstSuccess.status === 'fulfilled');
		const successfulIndex = decisions.findIndex((result) => result.status === 'fulfilled');
		if (decisions[0].status === 'rejected') {
			clientA.close();
			clientAClosed = true;
		} else if (decisions[1].status === 'rejected') {
			clientB.close();
			clientB = undefined;
		}
		const successfulDatabase = successfulIndex === 0 ? databaseA : databaseB;
		assert.equal((await successfulDatabase.select().from(appSchema.transactions)).length, 1);
		assert.equal((await successfulDatabase.select().from(appSchema.transaction_splits)).length, 1);
		assert.equal((await successfulDatabase.select().from(appSchema.ai_change_requests))[0].state, 'applied');
		assert.equal((await successfulDatabase.select().from(appSchema.ai_audit_events)
			.where(eq(appSchema.ai_audit_events.event_type, 'proposal_applied'))).length, 1);
		const retry = await decideMcpTransactionProposal(successfulDatabase, decision);
		assert.deepEqual(retry, firstSuccess.value);
		assert.equal((await successfulDatabase.select().from(appSchema.transactions)).length, 1);
	} finally {
		clientB?.close();
		if (!clientAClosed) clientA.close();
		await rm(directory, { recursive: true, force: true });
	}
});

test('two independent DB clients can confirm one edit only once and never duplicate responsibility splits', async () => {
	const directory = await mkdtemp(join(tmpdir(), 'finanzar-mcp-edit-race-'));
	const dbPath = join(directory, 'test.db');
	const url = `file:${dbPath}`;
	const clientA = createClient({ url });
	let clientB: ReturnType<typeof createClient> | undefined;
	try {
		for (const name of [
			'0000_fluffy_diamondback.sql', '0001_seed_owner.sql', '0002_abnormal_chronomancer.sql',
			'0003_sad_grey_gargoyle.sql', '0004_auth_accounts.sql', '0005_mcp_oauth.sql',
		]) await clientA.executeMultiple(await readFile(new URL(`../../drizzle/${name}`, import.meta.url), 'utf8'));
		const databaseA = drizzle(clientA, { schema });
		await databaseA.insert(authSchema.user).values({ id: 'edit-race-owner', name: 'Owner', email: 'edit-race@example.invalid' });
		await clientA.executeMultiple(await readFile(new URL('../../drizzle/0006_private_ledger_owner.sql', import.meta.url), 'utf8'));
		await clientA.executeMultiple(await readFile(new URL('../../drizzle/0007_mcp_access_grants.sql', import.meta.url), 'utf8'));
		await clientA.executeMultiple(await readFile(new URL('../../drizzle/0008_sour_bloodstrike.sql', import.meta.url), 'utf8'));
		const now = Date.now();
		const clientId = 'https://edit-race.example/client.json';
		const scopes = ['finanzar:read', 'finanzar:transactions:write'];
		await databaseA.insert(authSchema.oauthClient).values({
			id: 'edit-race-client-row', clientId, name: 'Edit race client',
			redirectUris: ['https://edit-race.example/callback'], disabled: false,
		});
		await databaseA.insert(authSchema.oauthConsent).values({
			id: 'edit-race-consent', clientId, userId: 'edit-race-owner',
			createdAt: new Date(now), updatedAt: new Date(now), scopes,
		});
		await databaseA.insert(appSchema.mcp_access_grants).values({
			jti: 'edit-race-jti', owner_user_id: 'edit-race-owner', client_id: clientId,
			issued_at: new Date(now), expires_at: new Date(now + 60_000),
		});
		await databaseA.insert(appSchema.payment_methods).values({ id: 'edit-race-cash', name: 'Efectivo', type: 'cash' });
		await databaseA.insert(appSchema.people).values({ id: 'edit-race-leo', name: 'Leo' });
		await databaseA.insert(appSchema.transactions).values({
			id: 'edit-race-transaction', date: '2026-10-10', month: '2026-10', type: 'expense', amount: 10_000,
			description: 'Compra antes', payer_person_id: 'owner_1', payment_method_id: 'edit-race-cash', status: 'active',
		});
		await databaseA.insert(appSchema.transaction_splits).values({
			id: 'edit-race-original-split', transaction_id: 'edit-race-transaction', person_id: 'owner_1', amount: 10_000,
		});
		const proposal = await createMcpTransactionUpdateProposal(databaseA, {
			ownerUserId: 'edit-race-owner', clientId, jti: 'edit-race-jti', scopes,
			update: {
				idempotency_key: 'edit-race-proposal-01', transaction_id: 'edit-race-transaction',
				date: '2026-10-10', amount_cents: 15_000, description: 'Compra después',
				payer_person_id: 'owner_1', payment_method_id: 'edit-race-cash',
				responsibilities: [
					{ person_id: 'owner_1', amount_cents: 10_000 },
					{ person_id: 'edit-race-leo', amount_cents: 5_000 },
				],
			}, now,
		});
		assert.equal((await databaseA.select().from(appSchema.transactions))[0].amount, 10_000,
			'proposal creation must leave the source movement unchanged');

		clientB = createClient({ url });
		const databaseB = drizzle(clientB, { schema });
		const decision = {
			ownerUserId: 'edit-race-owner', approvedByUserId: 'edit-race-owner', proposalId: proposal.id,
			clientId, jti: 'edit-race-jti', scopes, approvalChannel: 'mcp_chat' as const,
		};
		const decisions = await Promise.allSettled([
			decideMcpTransactionProposal(databaseA, decision),
			decideMcpTransactionProposal(databaseB, decision),
		]);
		const firstSuccess = decisions.find((result) => result.status === 'fulfilled');
		assert.ok(firstSuccess && firstSuccess.status === 'fulfilled', JSON.stringify(decisions));

		const [updated] = await databaseA.select().from(appSchema.transactions)
			.where(eq(appSchema.transactions.id, 'edit-race-transaction'));
		assert.equal(updated.amount, 15_000);
		assert.equal(updated.description, 'Compra después');
		const splits = await databaseA.select({ person_id: appSchema.transaction_splits.person_id, amount: appSchema.transaction_splits.amount })
			.from(appSchema.transaction_splits).where(eq(appSchema.transaction_splits.transaction_id, 'edit-race-transaction'));
		assert.deepEqual(splits.sort((a, b) => a.person_id.localeCompare(b.person_id)), [
			{ person_id: 'edit-race-leo', amount: 5_000 },
			{ person_id: 'owner_1', amount: 10_000 },
		]);
		assert.equal((await databaseA.select().from(appSchema.ai_change_requests)
			.where(eq(appSchema.ai_change_requests.id, proposal.id)))[0].state, 'applied');
		const appliedEvents = await databaseA.select().from(appSchema.ai_audit_events)
			.where(eq(appSchema.ai_audit_events.change_request_id, proposal.id));
		assert.equal(appliedEvents.filter((event) => event.event_type === 'proposal_applied').length, 1);
		const retry = await decideMcpTransactionProposal(databaseA, decision);
		assert.deepEqual(retry, firstSuccess.value);
		assert.equal((await databaseA.select().from(appSchema.transaction_splits)
			.where(eq(appSchema.transaction_splits.transaction_id, 'edit-race-transaction'))).length, 2);
	} finally {
		clientB?.close();
		clientA.close();
		await rm(directory, { recursive: true, force: true });
	}
});

test('two independent DB clients cannot apply different edits to the same installment group snapshot', async () => {
	const directory = await mkdtemp(join(tmpdir(), 'finanzar-mcp-group-race-'));
	const dbPath = join(directory, 'test.db');
	const url = `file:${dbPath}`;
	const clientA = createClient({ url });
	let clientB: ReturnType<typeof createClient> | undefined;
	try {
		for (const name of [
			'0000_fluffy_diamondback.sql', '0001_seed_owner.sql', '0002_abnormal_chronomancer.sql',
			'0003_sad_grey_gargoyle.sql', '0004_auth_accounts.sql', '0005_mcp_oauth.sql',
		]) await clientA.executeMultiple(await readFile(new URL(`../../drizzle/${name}`, import.meta.url), 'utf8'));
		const databaseA = drizzle(clientA, { schema });
		await databaseA.insert(authSchema.user).values({ id: 'group-race-owner', name: 'Owner', email: 'group-race@example.invalid' });
		await clientA.executeMultiple(await readFile(new URL('../../drizzle/0006_private_ledger_owner.sql', import.meta.url), 'utf8'));
		await clientA.executeMultiple(await readFile(new URL('../../drizzle/0007_mcp_access_grants.sql', import.meta.url), 'utf8'));
		await clientA.executeMultiple(await readFile(new URL('../../drizzle/0008_sour_bloodstrike.sql', import.meta.url), 'utf8'));
		const now = Date.now();
		const clientId = 'https://group-race.example/client.json';
		const scopes = ['finanzar:read', 'finanzar:transactions:write'];
		await databaseA.insert(authSchema.oauthClient).values({
			id: 'group-race-client-row', clientId, name: 'Group race client', redirectUris: ['https://group-race.example/callback'], disabled: false,
		});
		await databaseA.insert(authSchema.oauthConsent).values({
			id: 'group-race-consent', clientId, userId: 'group-race-owner', createdAt: new Date(now), updatedAt: new Date(now), scopes,
		});
		await databaseA.insert(appSchema.mcp_access_grants).values({
			jti: 'group-race-jti', owner_user_id: 'group-race-owner', client_id: clientId,
			issued_at: new Date(now), expires_at: new Date(now + 60_000),
		});
		await databaseA.insert(appSchema.cards).values({
			id: 'group-race-card', name: 'ICBC', owner_person_id: 'owner_1', closing_day: 24, due_day: 6,
		});
		await databaseA.insert(appSchema.payment_methods).values({
			id: 'group-race-method', name: 'ICBC', type: 'credit_card', card_id: 'group-race-card',
		});
		await databaseA.insert(appSchema.installment_groups).values({
			id: 'group-race-group', description: 'Compra cuotas', total_amount: 20_000, installments_total: 2, start_month: '2026-10',
		});
		for (const [number, month] of [[1, '2026-10'], [2, '2026-11']] as const) {
			const id = `group-race-row-${number}`;
			await databaseA.insert(appSchema.transactions).values({
				id, date: `${month}-06`, month, type: 'expense', amount: 10_000,
				description: `Compra cuotas (Cuota ${number}/2)`, payer_person_id: 'owner_1',
				payment_method_id: 'group-race-method', card_id: 'group-race-card', installment_group_id: 'group-race-group', status: 'active',
			});
			await databaseA.insert(appSchema.transaction_splits).values({
				id: `${id}-split`, transaction_id: id, person_id: 'owner_1', amount: 10_000,
			});
		}
		const propose = (key: string, total: number) => createMcpInstallmentGroupUpdateProposal(databaseA, {
			ownerUserId: 'group-race-owner', clientId, jti: 'group-race-jti', scopes,
			update: {
				idempotency_key: key, installment_group_id: 'group-race-group', scope: 'entire_recorded_group',
				purchase_total_cents: total, description: 'Compra cuotas corregida', payer_person_id: 'owner_1',
				payment_method_id: 'group-race-method', responsibilities: [{ person_id: 'owner_1', amount_cents: total }],
			}, now,
		});
		const first = await propose('group-race-proposal-01', 30_000);
		const second = await propose('group-race-proposal-02', 40_000);
		clientB = createClient({ url });
		const databaseB = drizzle(clientB, { schema });
		const decide = (proposalId: string) => decideMcpTransactionProposal(databaseA, {
			ownerUserId: 'group-race-owner', approvedByUserId: 'group-race-owner', proposalId,
			clientId, jti: 'group-race-jti', scopes, approvalChannel: 'mcp_chat',
		});
		const outcomes = await Promise.allSettled([
			decide(first.id),
			decideMcpTransactionProposal(databaseB, {
				ownerUserId: 'group-race-owner', approvedByUserId: 'group-race-owner', proposalId: second.id,
				clientId, jti: 'group-race-jti', scopes, approvalChannel: 'mcp_chat',
			}),
		]);
		assert.equal(outcomes.filter((outcome) => outcome.status === 'fulfilled').length, 1, JSON.stringify(outcomes));
		const group = (await databaseA.select().from(appSchema.installment_groups)
			.where(eq(appSchema.installment_groups.id, 'group-race-group')))[0];
		assert.ok(group.total_amount === 30_000 || group.total_amount === 40_000);
		const rows = await databaseA.select().from(appSchema.transactions)
			.where(eq(appSchema.transactions.installment_group_id, 'group-race-group'));
		assert.equal(rows.length, 2);
		assert.equal(rows.reduce((sum, row) => sum + row.amount, 0), group.total_amount);
		assert.equal((await databaseA.select().from(appSchema.transaction_splits)).length, 2);
		assert.equal((await databaseA.select().from(appSchema.ai_audit_events)
			.where(eq(appSchema.ai_audit_events.event_type, 'proposal_applied'))).length, 1);
	} finally {
		clientB?.close();
		clientA.close();
		await rm(directory, { recursive: true, force: true });
	}
});
