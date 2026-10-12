import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as appSchema from '../db/schema';
import * as authSchema from '../db/auth-schema';
import { getMcpInstallmentGroup, getMcpTransaction, listMcpRecurringRules } from './mcp-read-service';
import { auditMcpFinancialData, getMcpCardStatement, getMcpSpendingSummary, searchMcpTransactions } from './mcp-query-service';

const schema = { ...appSchema, ...authSchema };

async function fixture() {
	const client = createClient({ url: 'file::memory:' });
	for (const migration of [
		'0000_fluffy_diamondback.sql', '0001_seed_owner.sql', '0002_abnormal_chronomancer.sql',
		'0003_sad_grey_gargoyle.sql', '0004_auth_accounts.sql', '0005_mcp_oauth.sql',
	]) {
		await client.executeMultiple(readFileSync(new URL(`../../drizzle/${migration}`, import.meta.url), 'utf8'));
	}
	const database = drizzle(client, { schema });
	await database.insert(authSchema.user).values({ id: 'auth-owner', name: 'Augusto', email: 'owner@example.invalid' });
	await client.executeMultiple(readFileSync(new URL('../../drizzle/0006_private_ledger_owner.sql', import.meta.url), 'utf8'));
	await database.insert(appSchema.people).values({ id: 'leo', name: 'Leo' });
	await database.insert(appSchema.cards).values({ id: 'card-orange', name: 'Naranja', owner_person_id: 'owner_1' });
	await database.insert(appSchema.payment_methods).values({ id: 'pm-orange', name: 'Tarjeta Naranja', type: 'credit_card', card_id: 'card-orange' });
	return { client, database: database as Parameters<typeof getMcpTransaction>[0] };
}

test('MCP transaction and installment reads are owner-guarded and distinguish purchase total from recorded rows', async () => {
	const f = await fixture();
	try {
		await f.database.insert(appSchema.installment_groups).values({
			id: 'group-1', description: 'Compra', total_amount: 100_000, installments_total: 6, start_month: '2026-10',
		});
		await f.database.insert(appSchema.transactions).values([
			{ id: 'tx-1', type: 'expense', date: '2026-10-10', month: '2026-10', amount: 16_667, description: 'Compra (Cuota 4/6)', payer_person_id: 'owner_1', payment_method_id: 'pm-orange', card_id: 'card-orange', installment_group_id: 'group-1', status: 'active' },
			{ id: 'tx-2', type: 'expense', date: '2026-11-10', month: '2026-11', amount: 16_667, description: 'Compra (Cuota 5/6)', payer_person_id: 'owner_1', payment_method_id: 'pm-orange', card_id: 'card-orange', installment_group_id: 'group-1', status: 'active' },
		]);
		await f.database.insert(appSchema.transaction_splits).values([
			{ id: 'split-1', transaction_id: 'tx-1', person_id: 'leo', amount: 16_667 },
			{ id: 'split-2', transaction_id: 'tx-2', person_id: 'leo', amount: 16_667 },
		]);
		const detail = await getMcpTransaction(f.database, 'auth-owner', 'tx-1');
		assert.equal(detail?.amount_cents, 16_667);
		assert.equal(detail?.payer?.name, 'Augusto');
		assert.equal(detail?.card?.name, 'Naranja');
		assert.equal(detail?.responsibilities[0]?.person, 'Leo');
		assert.equal(detail?.installment_group?.purchase_total_cents, 100_000);
		assert.equal(await getMcpTransaction(f.database, 'auth-owner', 'missing'), null);

		const group = await getMcpInstallmentGroup(f.database, 'auth-owner', 'group-1');
		assert.equal(group?.purchase_total_cents, 100_000);
		assert.equal(group?.installments_total, 6);
		assert.equal(group?.registered_installments, 2);
		assert.deepEqual(group?.installments.map((row) => row.month), ['2026-10', '2026-11']);
		await assert.rejects(getMcpInstallmentGroup(f.database, 'other-user', 'group-1'), /no es titular/);
	} finally { f.client.close(); }
});

test('MCP recurring-rule read labels rules as rules and bounds output', async () => {
	const f = await fixture();
	try {
		await f.database.insert(appSchema.recurring_rules).values([
			{ id: 'rule-a', description: 'Internet', amount: 50_000, type: 'expense', payer_person_id: 'owner_1', payment_method_id: 'pm-orange', card_id: 'card-orange', day_of_month: 5, active: true },
			{ id: 'rule-b', description: 'Servicio pausado', amount: 10_000, type: 'expense', payer_person_id: 'owner_1', payment_method_id: 'pm-orange', card_id: null, day_of_month: 20, active: false },
		]);
		const result = await listMcpRecurringRules(f.database, 'auth-owner', { activeOnly: true, limit: 1 });
		assert.equal(result.total_matching_records, 1);
		assert.equal(result.truncated, false);
		assert.equal(result.rules[0]?.amount_cents, 50_000);
		assert.equal(result.rules[0]?.payer.name, 'Augusto');
		await assert.rejects(listMcpRecurringRules(f.database, 'other-user', { activeOnly: false, limit: 100 }), /no es titular/);
	} finally { f.client.close(); }
});

test('flexible search filters by impact month, responsibility and payer and uses a filter-bound cursor', async () => {
	const f = await fixture();
	try {
		await f.database.insert(appSchema.transactions).values([
			{ id: 'a-tx', type: 'expense', date: '2026-10-10', month: '2026-10', amount: 20_000, description: 'Compra compartida A', payer_person_id: 'owner_1', payment_method_id: 'pm-orange', card_id: 'card-orange', status: 'active' },
			{ id: 'b-tx', type: 'expense', date: '2026-10-11', month: '2026-10', amount: 30_000, description: 'Compra compartida B', payer_person_id: 'owner_1', payment_method_id: 'pm-orange', card_id: 'card-orange', status: 'active' },
		]);
		await f.database.insert(appSchema.transaction_splits).values([
			{ id: 'a-leo', transaction_id: 'a-tx', person_id: 'leo', amount: 15_000 },
			{ id: 'a-owner', transaction_id: 'a-tx', person_id: 'owner_1', amount: 5_000 },
			{ id: 'b-leo', transaction_id: 'b-tx', person_id: 'leo', amount: 30_000 },
		]);
		const first = await searchMcpTransactions(f.database, 'auth-owner', { month: '2026-10', person_id: 'leo', limit: 1 });
		assert.equal(first.total_matching_records, 2);
		assert.equal(first.records[0]?.id, 'a-tx');
		assert.ok(first.next_cursor);
		const second = await searchMcpTransactions(f.database, 'auth-owner', { month: '2026-10', person_id: 'leo', limit: 1, cursor: first.next_cursor! });
		assert.equal(second.records[0]?.id, 'b-tx');
		assert.equal(second.next_cursor, null);
		await assert.rejects(searchMcpTransactions(f.database, 'auth-owner', { month: '2026-11', person_id: 'leo', limit: 1, cursor: first.next_cursor! }), /cursor no es válido/);
		const filtered = await searchMcpTransactions(f.database, 'auth-owner', { month: '2026-10', person_id: 'leo', payer_person_id: 'owner_1', description_contains: 'compartida B', limit: 10 });
		assert.deepEqual(filtered.records.map((record) => record.id), ['b-tx']);
		assert.equal(filtered.records[0]?.responsibilities.find((split) => split.person_id === 'owner_1')?.amount_cents, undefined);
	} finally { f.client.close(); }
});

test('summary and card statement distinguish assigned responsibility from full card movement total', async () => {
	const f = await fixture();
	try {
		await f.database.insert(appSchema.transactions).values({
			id: 'shared-tx', type: 'expense', date: '2026-10-10', month: '2026-10', amount: 20_000,
			description: 'Gasto compartido', payer_person_id: 'owner_1', payment_method_id: 'pm-orange', card_id: 'card-orange', status: 'active',
		});
		await f.database.insert(appSchema.transaction_splits).values([
			{ id: 'shared-leo', transaction_id: 'shared-tx', person_id: 'leo', amount: 15_000 },
			{ id: 'shared-owner', transaction_id: 'shared-tx', person_id: 'owner_1', amount: 5_000 },
		]);
		const byResponsible = await getMcpSpendingSummary(f.database, 'auth-owner', {
			from_month: '2026-10', to_month: '2026-10', type: 'expense', status: 'active', person_id: 'leo', group_by: ['card'],
		});
		assert.equal(byResponsible.groups[0]?.expenses_cents, 15_000);
		const statement = await getMcpCardStatement(f.database, 'auth-owner', 'card-orange', '2026-10');
		assert.equal(statement?.movement_total_cents, 20_000);
		assert.equal(statement?.totals_by_responsible.find((row) => row.person === 'Leo')?.total_cents, 15_000);
		assert.match(statement?.payment_status ?? '', /unknown/);
	} finally { f.client.close(); }
});

test('integrity audit reports missing responsibility, split mismatch and card/payment mismatch without condemning partial groups', async () => {
	const f = await fixture();
	try {
		await f.database.insert(appSchema.installment_groups).values({ id: 'partial-group', description: 'Serie parcial', total_amount: 60_000, installments_total: 6, start_month: '2026-10' });
		await f.database.insert(appSchema.transactions).values([
			{ id: 'no-split', type: 'expense', date: '2026-10-10', month: '2026-10', amount: 20_000, description: 'Sin responsable', payer_person_id: 'owner_1', payment_method_id: 'pm-orange', card_id: null, status: 'active' },
			{ id: 'bad-split', type: 'expense', date: '2026-10-11', month: '2026-10', amount: 20_000, description: 'División errónea', payer_person_id: 'owner_1', payment_method_id: 'pm-orange', card_id: 'card-orange', status: 'active' },
			{ id: 'bad-card', type: 'expense', date: '2026-10-12', month: '2026-10', amount: 5_000, description: 'Tarjeta distinta', payer_person_id: 'owner_1', payment_method_id: 'pm-orange', card_id: null, status: 'active' },
			{ id: 'partial-1', type: 'expense', date: '2026-10-13', month: '2026-10', amount: 10_000, description: 'Serie parcial (Cuota 4/6)', payer_person_id: 'owner_1', payment_method_id: 'pm-orange', card_id: 'card-orange', installment_group_id: 'partial-group', status: 'active' },
		]);
		await f.database.insert(appSchema.transaction_splits).values([
			{ id: 'bad-split-row', transaction_id: 'bad-split', person_id: 'leo', amount: 19_000 },
			{ id: 'partial-split-row', transaction_id: 'partial-1', person_id: 'leo', amount: 10_000 },
		]);
		const audit = await auditMcpFinancialData(f.database, 'auth-owner', { from_month: '2026-10', to_month: '2026-10', limit: 100 });
		assert.equal(audit.movements_checked, 4);
		assert.equal(audit.summary.expenses_missing_responsibilities, 2);
		assert.equal(audit.summary.split_amount_mismatches, 1);
		assert.equal(audit.summary.card_payment_method_mismatches, 2);
		assert.equal(audit.summary.installment_group_total_mismatches, 0);
		assert.ok(audit.findings.some((finding) => finding.issue === 'expense_without_responsible'));
		assert.ok(audit.findings.some((finding) => finding.issue === 'splits_do_not_equal_movement'));
	} finally { f.client.close(); }
});
