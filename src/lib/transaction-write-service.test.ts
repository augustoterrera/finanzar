import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from '../db/schema';
import { buildInstallmentSchedule } from './transaction-domain';
import { persistTransaction, prepareTransaction } from './transaction-write-service';

async function makeDatabase() {
	const client = createClient({ url: 'file::memory:' });
	for (const migration of ['0000_fluffy_diamondback.sql', '0001_seed_owner.sql', '0002_abnormal_chronomancer.sql', '0003_sad_grey_gargoyle.sql', '0004_auth_accounts.sql']) {
		await client.executeMultiple(readFileSync(new URL(`../../drizzle/${migration}`, import.meta.url), 'utf8'));
	}
	await client.execute("INSERT INTO user (id, name, email) VALUES ('owner-user', 'Owner', 'owner@test.invalid')");
	await client.executeMultiple(readFileSync(new URL('../../drizzle/0006_private_ledger_owner.sql', import.meta.url), 'utf8'));
	const database = drizzle(client, { schema });
	return { client, database };
}

test('persists a partial installment series atomically with the full purchase total', async () => {
	const { client, database } = await makeDatabase();
	try {
		await database.insert(schema.people).values({ id: 'leo', name: 'Leo', is_owner: false });
		await database.insert(schema.payment_methods).values({ id: 'cash', name: 'Efectivo', type: 'cash' });
		const schedule = buildInstallmentSchedule({
			splits: [{ person_id: 'leo', amount: 100_000 }], installmentsTotal: 6,
			startingInstallment: 4, billingMonth: '2026-10', dateDay: 10,
		});
		const result = await persistTransaction(database as Parameters<typeof persistTransaction>[0], 'owner-user', {
			type: 'expense', date: '2026-10-10', billingMonth: '2026-10', amountCents: 100_000,
			description: 'Compra de prueba', payerPersonId: 'owner_1', paymentMethodId: 'cash', cardId: null,
			installmentsTotal: 6, splits: [{ person_id: 'leo', amount: 100_000 }], schedule,
		});

		assert.ok(result.installmentGroupId);
		assert.equal(result.transactionIds.length, 3);
		const [group] = await database.select().from(schema.installment_groups);
		const rows = await database.select().from(schema.transactions);
		const splits = await database.select().from(schema.transaction_splits);
		assert.equal(group.total_amount, 100_000, 'group stores full purchase amount, not remaining rows');
		assert.equal(group.installments_total, 6);
		assert.deepEqual(rows.map((row) => row.amount), [16_667, 16_667, 16_667]);
		assert.deepEqual(rows.map((row) => row.month), ['2026-10', '2026-11', '2026-12']);
		assert.equal(splits.reduce((total, split) => total + split.amount, 0), 50_001);
	} finally { client.close(); }
});

test('rejects an invalid split before writing any rows', async () => {
	const { client, database } = await makeDatabase();
	try {
		await database.insert(schema.payment_methods).values({ id: 'cash', name: 'Efectivo', type: 'cash' });
		await assert.rejects(persistTransaction(database as Parameters<typeof persistTransaction>[0], 'owner-user', {
			type: 'expense', date: '2026-10-10', billingMonth: '2026-10', amountCents: 100,
			description: 'Inválido', payerPersonId: 'owner_1', paymentMethodId: 'cash', cardId: null,
			installmentsTotal: 1, splits: [{ person_id: 'owner_1', amount: 99 }], schedule: [],
		}));
		assert.equal((await database.select().from(schema.transactions)).length, 0);
		assert.equal((await database.select().from(schema.transaction_splits)).length, 0);
	} finally { client.close(); }
});

test('shared preparation validates owner, participants, card, payment, impact month, and full installment schedule', async () => {
	const { client, database } = await makeDatabase();
	try {
		await database.insert(schema.people).values({ id: 'leo', name: 'Leo', is_owner: false });
		await database.insert(schema.cards).values({ id: 'naranja', name: 'Naranja', owner_person_id: 'owner_1', closing_day: 20, due_day: 10 });
		await database.insert(schema.payment_methods).values({ id: 'naranja-payment', name: 'Tarjeta Naranja', type: 'credit_card', card_id: 'naranja' });
		await database.insert(schema.payment_methods).values({ id: 'invalid-cash', name: 'Efectivo inválido', type: 'cash', card_id: 'naranja' });
		const valid = await prepareTransaction(database as Parameters<typeof prepareTransaction>[0], 'owner-user', {
			type: 'expense', date: '2026-09-26', amount: '180000,00', description: 'Compra en cuotas',
			payerPersonId: 'owner_1', paymentMethodId: 'naranja-payment', splitsJson: '[{"person_id":"leo","amount":180000}]',
			installmentsTotal: '6', startingInstallment: '4', impactMonth: '2026-10',
		});
		assert.ok('input' in valid);
		if (!('input' in valid)) return;
		assert.equal(valid.input.amountCents, 18_000_000, 'the submitted value remains the full purchase total');
		assert.equal(valid.input.cardId, 'naranja');
		assert.equal(valid.input.billingMonth, '2026-10');
		assert.deepEqual(valid.input.schedule.map(({ installmentNumber, month, amount }) => [installmentNumber, month, amount]), [
			[4, '2026-10', 3_000_000], [5, '2026-11', 3_000_000], [6, '2026-12', 3_000_000],
		]);
		await assert.rejects(persistTransaction(database as Parameters<typeof persistTransaction>[0], 'not-owner', valid.input), /no es titular/);
		assert.equal((await database.select().from(schema.transactions)).length, 0, 'a prepared draft still cannot be persisted by another account');
		const invalidOwner = prepareTransaction(database as Parameters<typeof prepareTransaction>[0], 'not-owner', {
			type: 'expense', date: '2026-10-10', amount: '100', description: 'No autorizado',
			payerPersonId: 'owner_1', paymentMethodId: 'naranja-payment', splitsJson: '[{"person_id":"leo","amount":100}]',
		});
		await assert.rejects(invalidOwner, /no es titular/);
		const invalidResponsible = await prepareTransaction(database as Parameters<typeof prepareTransaction>[0], 'owner-user', {
			type: 'expense', date: '2026-10-10', amount: '100', description: 'Responsable inexistente',
			payerPersonId: 'owner_1', paymentMethodId: 'naranja-payment', splitsJson: '[{"person_id":"missing","amount":100}]',
		});
		assert.deepEqual(invalidResponsible, { error: 'Una o más personas de las divisiones no existen' });
		const invalidImpactMonth = await prepareTransaction(database as Parameters<typeof prepareTransaction>[0], 'owner-user', {
			type: 'expense', date: '2026-10-10', amount: '100', description: 'Mes inválido',
			payerPersonId: 'owner_1', paymentMethodId: 'naranja-payment', splitsJson: '[{"person_id":"leo","amount":100}]', impactMonth: '2026-13',
		});
		assert.deepEqual(invalidImpactMonth, { error: 'El mes de impacto debe ser válido y tener formato AAAA-MM' });
		const invalidPaymentCard = await prepareTransaction(database as Parameters<typeof prepareTransaction>[0], 'owner-user', {
			type: 'expense', date: '2026-10-10', amount: '100', description: 'Medio incompatible',
			payerPersonId: 'owner_1', paymentMethodId: 'invalid-cash', splitsJson: '[{"person_id":"leo","amount":100}]',
		});
		assert.deepEqual(invalidPaymentCard, { error: 'Un medio de pago que no es tarjeta no puede tener una tarjeta asociada' });
	} finally { client.close(); }
});
