import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as appSchema from '../db/schema';
import * as authSchema from '../db/auth-schema';

const schema = { ...appSchema, ...authSchema };

test('proposal, idempotency and audit migration is additive and enforces unique operation keys', async () => {
	const client = createClient({ url: 'file::memory:' });
	try {
		for (const migration of [
			'0000_fluffy_diamondback.sql', '0001_seed_owner.sql', '0002_abnormal_chronomancer.sql',
			'0003_sad_grey_gargoyle.sql', '0004_auth_accounts.sql', '0005_mcp_oauth.sql',
			'0006_private_ledger_owner.sql', '0007_mcp_access_grants.sql', '0008_sour_bloodstrike.sql',
		]) {
			await client.executeMultiple(readFileSync(new URL(`../../drizzle/${migration}`, import.meta.url), 'utf8'));
		}
		const database = drizzle(client, { schema });
		const now = Date.now();
		await client.execute({
			sql: 'INSERT INTO user (id, name, email, email_verified, created_at, updated_at, username) VALUES (?, ?, ?, ?, ?, ?, ?)',
			args: ['proposal-owner', 'Augusto', 'proposal-owner@test.invalid', 1, now, now, 'proposal-owner'],
		});
		await database.insert(appSchema.ledger_accounts).values({ id: 'private', owner_user_id: 'proposal-owner' });
		const [proposal] = await database.insert(appSchema.ai_change_requests).values({
			owner_user_id: 'proposal-owner', client_id: 'test-client', operation: 'create_transaction',
			payload_json: '{"description":"Compra fixture"}', payload_hash: 'a'.repeat(64), preview_json: '{"month":"2026-10"}',
			expires_at: new Date(now + 30 * 60 * 1000),
		}).returning({ id: appSchema.ai_change_requests.id });
		await database.insert(appSchema.ai_idempotency).values({
			owner_user_id: 'proposal-owner', client_id: 'test-client', operation: 'create_transaction',
			idempotency_key: 'request-key-1', payload_hash: 'a'.repeat(64), change_request_id: proposal.id,
		});
		await database.insert(appSchema.ai_audit_events).values({
			owner_user_id: 'proposal-owner', change_request_id: proposal.id, actor_type: 'ai_connection',
			actor_id: 'test-client', event_type: 'proposal_created', metadata_json: '{"payload_hash":"redacted-fixture-hash"}',
		});

		await assert.rejects(database.insert(appSchema.ai_idempotency).values({
			owner_user_id: 'proposal-owner', client_id: 'test-client', operation: 'create_transaction',
			idempotency_key: 'request-key-1', payload_hash: 'b'.repeat(64), change_request_id: proposal.id,
		}));
		assert.equal((await database.select().from(appSchema.ai_change_requests)).length, 1);
		assert.equal((await database.select().from(appSchema.ai_idempotency)).length, 1);
		assert.equal((await database.select().from(appSchema.ai_audit_events)).length, 1);
	} finally {
		client.close();
	}
});
