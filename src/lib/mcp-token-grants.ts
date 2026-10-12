import type { db } from '@/db';
import { mcp_access_grants } from '@/db/schema';

type AccessTokenClaims = {
	iss?: unknown;
	aud?: unknown;
	sub?: unknown;
	client_id?: unknown;
	jti?: unknown;
	exp?: unknown;
	iat?: unknown;
	scope?: unknown;
};

function decodeLocalTokenPayload(token: string): AccessTokenClaims | null {
	const parts = token.split('.');
	if (parts.length !== 3 || parts.some((part) => !part)) return null;
	try {
		return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as AccessTokenClaims;
	} catch { return null; }
}

/** Called only after our own Better Auth token endpoint has just minted the response. */
export async function recordIssuedMcpAccessToken(
	database: typeof db,
	token: string,
	configuration: { issuer: string; resource: string; now?: number },
) {
	const claims = decodeLocalTokenPayload(token);
	if (!claims) return false;
	const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
	const scopes = typeof claims.scope === 'string' ? claims.scope.split(/\s+/) : [];
	if (claims.iss !== configuration.issuer || !audience.includes(configuration.resource) || !scopes.includes('finanzar:read')) return false;
	if (typeof claims.sub !== 'string' || typeof claims.client_id !== 'string' || typeof claims.jti !== 'string'
		|| typeof claims.iat !== 'number' || typeof claims.exp !== 'number') {
		throw new Error('El token de Finanzar no contiene los identificadores de revocación esperados.');
	}
	const now = configuration.now ?? Date.now();
	if (claims.exp * 1000 <= now || claims.iat * 1000 > now + 60_000) throw new Error('El token de Finanzar no tiene tiempos válidos.');
	await database.insert(mcp_access_grants).values({
		jti: claims.jti,
		owner_user_id: claims.sub,
		client_id: claims.client_id,
		issued_at: new Date(claims.iat * 1000),
		expires_at: new Date(claims.exp * 1000),
	});
	return true;
}

export async function persistMcpGrantFromTokenResponse(
	database: typeof db,
	response: Response,
	configuration: { issuer: string; resource: string; now?: number },
) {
	if (!response.ok) return false;
	let token: string;
	try {
		const payload = await response.clone().json() as { access_token?: unknown };
		if (typeof payload.access_token !== 'string') return false;
		token = payload.access_token;
	} catch { return false; }
	return recordIssuedMcpAccessToken(database, token, configuration);
}
