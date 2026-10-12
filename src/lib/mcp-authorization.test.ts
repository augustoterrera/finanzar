import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { eq } from 'drizzle-orm';
import * as appSchema from '../db/schema';
import * as authSchema from '../db/auth-schema';
import { hasActiveMcpAuthorization } from './mcp-authorization';

const schema = { ...appSchema, ...authSchema };

test('active-token check requires a live token, enabled client and unrevoked read consent', async () => {
	const client = createClient({ url: 'file::memory:' });
	try {
		for (const name of ['0004_auth_accounts.sql', '0005_mcp_oauth.sql', '0006_private_ledger_owner.sql']) {
			await client.executeMultiple(readFileSync(new URL(`../../drizzle/${name}`, import.meta.url), 'utf8'));
		}
		await client.executeMultiple(readFileSync(new URL('../../drizzle/0007_mcp_access_grants.sql', import.meta.url), 'utf8'));
		const database = drizzle(client, { schema });
		const now = Date.now();
		await database.insert(authSchema.user).values({ id: 'auth-owner', name: 'Owner', email: 'owner@example.invalid' });
		await database.insert(authSchema.oauthClient).values({
			id: 'client-row', clientId: 'https://example.invalid/client.json',
			name: 'Test MCP Client', redirectUris: ['https://example.invalid/callback'], disabled: false,
		});
		await database.insert(appSchema.mcp_access_grants).values({
			jti: 'jti-test', owner_user_id: 'auth-owner', client_id: 'https://example.invalid/client.json',
			issued_at: new Date(now), expires_at: new Date(now + 60_000),
		});
		await database.insert(authSchema.oauthConsent).values({
			id: 'consent-row', clientId: 'https://example.invalid/client.json', userId: 'auth-owner',
			createdAt: new Date(now), updatedAt: new Date(now), scopes: ['finanzar:read'],
		});
		const authorization = { jti: 'jti-test', subject: 'auth-owner', clientId: 'https://example.invalid/client.json', now };
		const databaseType = database as Parameters<typeof hasActiveMcpAuthorization>[0];
		assert.equal(await hasActiveMcpAuthorization(databaseType, authorization), true);
		assert.equal(await hasActiveMcpAuthorization(databaseType, { ...authorization, requiredScopes: ['finanzar:read', 'finanzar:transactions:write'] }), false,
			'read consent must not authorize a write proposal');
		assert.equal(await hasActiveMcpAuthorization(databaseType, { ...authorization, subject: 'somebody-else' }), false);

		await database.update(authSchema.oauthConsent).set({ scopes: ['finanzar:read', 'finanzar:transactions:write'] }).where(eq(authSchema.oauthConsent.id, 'consent-row'));
		assert.equal(await hasActiveMcpAuthorization(databaseType, { ...authorization, requiredScopes: ['finanzar:read', 'finanzar:transactions:write'] }), true);
		await database.update(authSchema.oauthConsent).set({ scopes: [] }).where(eq(authSchema.oauthConsent.id, 'consent-row'));
		assert.equal(await hasActiveMcpAuthorization(databaseType, authorization), false);
		await database.update(authSchema.oauthConsent).set({ scopes: ['finanzar:read'] }).where(eq(authSchema.oauthConsent.id, 'consent-row'));
		await database.update(appSchema.mcp_access_grants).set({ revoked_at: new Date(now) }).where(eq(appSchema.mcp_access_grants.jti, 'jti-test'));
		assert.equal(await hasActiveMcpAuthorization(databaseType, authorization), false);
		await database.insert(appSchema.mcp_access_grants).values({
			jti: 'jti-reissued', owner_user_id: 'auth-owner', client_id: 'https://example.invalid/client.json',
			issued_at: new Date(now + 1), expires_at: new Date(now + 60_001),
		});
		assert.equal(await hasActiveMcpAuthorization(databaseType, authorization), false, 'reconsent must not revive the previous JWT');
		assert.equal(await hasActiveMcpAuthorization(databaseType, { ...authorization, jti: 'jti-reissued' }), true);
	} finally { client.close(); }
});
