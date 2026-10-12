import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { sql } from 'drizzle-orm';
import * as appSchema from '../db/schema';
import * as authSchema from '../db/auth-schema';
import { getFinanceContext, getMonthlyExpenseLedgerSnapshot } from './expense-ledger-service';

const schema = { ...appSchema, ...authSchema };
const migration = (name: string) => readFileSync(new URL(`../../drizzle/${name}`, import.meta.url), 'utf8');

async function beforeOwnershipMigration() {
	const client = createClient({ url: 'file::memory:' });
	for (const name of [
		'0000_fluffy_diamondback.sql', '0001_seed_owner.sql', '0002_abnormal_chronomancer.sql',
		'0003_sad_grey_gargoyle.sql', '0004_auth_accounts.sql', '0005_mcp_oauth.sql',
	]) await client.executeMultiple(migration(name));
	return { client, database: drizzle(client, { schema }) };
}

async function insertAuthUser(database: ReturnType<typeof drizzle>, id: string) {
	await database.insert(authSchema.user).values({ id, name: id, email: `${id}@example.invalid` });
}

test('ownership migration links exactly one auth user and preserves existing financial data', async () => {
	const f = await beforeOwnershipMigration();
	try {
		await insertAuthUser(f.database, 'owner-auth-id');
		await f.database.insert(appSchema.payment_methods).values({ id: 'cash', name: 'Efectivo', type: 'cash' });
		await f.database.insert(appSchema.transactions).values({
			id: 'legacy-expense', date: '2026-10-01', month: '2026-10', type: 'expense', amount: 54144662,
			description: 'Compra histórica', payer_person_id: 'owner_1', payment_method_id: 'cash',
		});
		const [before] = await f.database.select({ count: sql<number>`count(*)`, total: sql<number>`sum(${appSchema.transactions.amount})` }).from(appSchema.transactions);

		await f.client.executeMultiple(migration('0006_private_ledger_owner.sql'));

		const [ledger] = await f.database.select().from(appSchema.ledger_accounts);
		const [after] = await f.database.select({ count: sql<number>`count(*)`, total: sql<number>`sum(${appSchema.transactions.amount})` }).from(appSchema.transactions);
		assert.equal(ledger.owner_user_id, 'owner-auth-id');
		assert.deepEqual(after, before);
		const databaseType = f.database as Parameters<typeof getMonthlyExpenseLedgerSnapshot>[0];
		const snapshot = await getMonthlyExpenseLedgerSnapshot(databaseType, 'owner-auth-id', '2026-10');
		assert.equal(snapshot.ledgers.reduce((sum, item) => sum + item.total, 0), 54144662);
		const context = await getFinanceContext(databaseType, 'owner-auth-id');
		assert.equal(context.people.find((person) => person.id === 'owner_1')?.name, 'Augusto');
		assert.deepEqual(context.capabilities, [
			'finanzar_get_month_summary', 'finanzar_get_spending_summary', 'finanzar_get_card_statement',
			'finanzar_list_transactions', 'finanzar_search_transactions', 'finanzar_audit_data_integrity',
			'finanzar_get_transaction', 'finanzar_get_installment_group', 'finanzar_list_recurring_rules', 'finanzar_get_context',
			'finanzar_propose_create_transaction', 'finanzar_propose_update_transaction',
			'finanzar_propose_update_installment_group', 'finanzar_apply_confirmed_change',
			'finanzar_get_change_request', 'finanzar_cancel_change_request',
		]);
		await assert.rejects(getMonthlyExpenseLedgerSnapshot(databaseType, 'different-auth-user', '2026-10'), /titular/);
		await assert.rejects(
			f.database.insert(appSchema.ledger_accounts).values({ id: 'second-ledger', owner_user_id: 'owner-auth-id' }),
		);
	} finally { f.client.close(); }
});

test('ownership migration fails closed when there are zero auth users', async () => {
	const f = await beforeOwnershipMigration();
	try {
		await f.client.executeMultiple(migration('0006_private_ledger_owner.sql'));
		assert.deepEqual(await f.database.select().from(appSchema.ledger_accounts), []);
	} finally { f.client.close(); }
});

test('ownership migration fails closed when there are multiple auth users', async () => {
	const f = await beforeOwnershipMigration();
	try {
		await insertAuthUser(f.database, 'auth-one');
		await insertAuthUser(f.database, 'auth-two');
		await f.client.executeMultiple(migration('0006_private_ledger_owner.sql'));
		assert.deepEqual(await f.database.select().from(appSchema.ledger_accounts), []);
		assert.equal((await f.database.select().from(authSchema.user)).length, 2);
	} finally { f.client.close(); }
});
