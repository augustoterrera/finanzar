import { and, eq, gt, isNull } from 'drizzle-orm';
import type { DatabaseTransaction, db } from '@/db';
import { oauthClient, oauthConsent } from '@/db/auth-schema';
import { mcp_access_grants } from '@/db/schema';

function hasScopes(scopes: unknown, required: string[]) {
	let values: unknown = scopes;
	if (typeof values === 'string') {
		try { values = JSON.parse(values); }
		catch { return false; }
	}
	return Array.isArray(values) && required.every((scope) => values.includes(scope));
}

/**
 * The signed JWT gate validates cryptography; this durable lookup adds immediate
 * revocation. A valid token is unusable if its token row, client, or consent was
 * revoked, expired, or no longer matches the authenticated subject.
 */
export async function hasActiveMcpAuthorization(
	database: typeof db | DatabaseTransaction,
	input: { jti: string; subject: string; clientId: string; requiredScopes?: string[]; now?: number },
) {
	if (!input.jti || !input.subject || !input.clientId) return false;
	const now = input.now ?? Date.now();
	const [grant] = await database.select({ jti: mcp_access_grants.jti })
		.from(mcp_access_grants)
		.where(and(
			eq(mcp_access_grants.jti, input.jti),
			isNull(mcp_access_grants.revoked_at),
			gt(mcp_access_grants.expires_at, new Date(now)),
			eq(mcp_access_grants.owner_user_id, input.subject),
			eq(mcp_access_grants.client_id, input.clientId),
		))
		.limit(1);
	if (!grant) return false;
	const [[client], [consent]] = await Promise.all([
		database.select({ disabled: oauthClient.disabled }).from(oauthClient)
			.where(eq(oauthClient.clientId, input.clientId)).limit(1),
		database.select({ scopes: oauthConsent.scopes }).from(oauthConsent)
			.where(and(eq(oauthConsent.clientId, input.clientId), eq(oauthConsent.userId, input.subject))).limit(1),
	]);
	return Boolean(client && client.disabled !== true && consent
		&& hasScopes(consent.scopes, input.requiredScopes ?? ['finanzar:read']));
}

/** Used by human approval to honor revocation even after the proposing access token expires. */
export async function hasActiveMcpConnection(
	database: typeof db | DatabaseTransaction,
	input: { subject: string; clientId: string; requiredScopes: string[] },
) {
	if (!input.subject || !input.clientId) return false;
	const [[client], [consent]] = await Promise.all([
		database.select({ disabled: oauthClient.disabled }).from(oauthClient)
			.where(eq(oauthClient.clientId, input.clientId)).limit(1),
		database.select({ scopes: oauthConsent.scopes }).from(oauthConsent)
			.where(and(eq(oauthConsent.clientId, input.clientId), eq(oauthConsent.userId, input.subject))).limit(1),
	]);
	return Boolean(client && client.disabled !== true && consent && hasScopes(consent.scopes, input.requiredScopes));
}
