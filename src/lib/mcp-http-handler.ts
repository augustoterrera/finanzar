import { requireMcpAuth } from '@better-auth/mcp';
import {
	createMcpHandler,
	hostHeaderValidationResponse,
	localhostAllowedHostnames,
	originValidationResponse,
} from '@modelcontextprotocol/server';
import type { db } from '@/db';
import { createFinanzarAuth } from '@/lib/auth-config';
import { hasActiveMcpAuthorization } from '@/lib/mcp-authorization';
import { createFinanzarMcpServer } from '@/lib/mcp-server';

type FinanzarAuth = ReturnType<typeof createFinanzarAuth>;

export function createFinanzarMcpHttpHandler(auth: FinanzarAuth, database: typeof db, options: {
	resource: string;
	issuer: string;
	jwksUrl?: string;
	enabled: () => boolean;
}) {
	const resource = new URL(options.resource);
	const resourceHostname = resource.hostname;
	const localHostnames = localhostAllowedHostnames();
	const isLocalResource = localHostnames.includes(resourceHostname);
	const allowedHostnames = isLocalResource ? localHostnames : [resourceHostname];
	const sdkHandler = createMcpHandler(createFinanzarMcpServer(database), {
		legacy: 'reject',
		maxRequestBodySize: 64 * 1024,
	});
	const authenticatedHandler = requireMcpAuth(auth, async (request, claims) => {
		const scopeClaim = claims.scope;
		const scopes = typeof scopeClaim === 'string' ? scopeClaim.split(/\s+/).filter(Boolean) : [];
		const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
		const subject = typeof claims.sub === 'string' ? claims.sub : '';
		const clientId = typeof claims.client_id === 'string' ? claims.client_id : typeof claims.azp === 'string' ? claims.azp : '';
		const jti = typeof claims.jti === 'string' ? claims.jti : '';
		try {
			const active = await hasActiveMcpAuthorization(database, { jti, subject, clientId });
			if (!active) return new Response('Token revocado o autorización no vigente.', {
				status: 401,
				headers: { 'www-authenticate': 'Bearer error="invalid_token"', 'cache-control': 'private, no-store' },
			});
			return await sdkHandler.fetch(request, {
				authInfo: {
					token, clientId, scopes,
					expiresAt: typeof claims.exp === 'number' ? claims.exp : undefined,
					resource,
					extra: { ownerUserId: subject, jti, subject, clientId },
				},
			});
		} catch {
			return new Response('No se pudo validar la autorización.', { status: 503, headers: { 'cache-control': 'private, no-store' } });
		}
	}, {
		issuer: options.issuer,
		jwksUrl: options.jwksUrl ?? defaultJwksUrl(options.issuer),
		resource: resource.toString(),
		requiredScopes: ['finanzar:read'],
	});

	return async function handleMcpRequest(request: Request) {
		if (!options.enabled()) return new Response(null, { status: 404, headers: { 'cache-control': 'no-store' } });
		const hostRejection = hostHeaderValidationResponse(request, allowedHostnames);
		if (hostRejection) return withPrivateHeaders(hostRejection);
		const originRejection = originValidationResponse(request, allowedHostnames);
		if (originRejection) return withPrivateHeaders(originRejection);
		const requestOrigin = request.headers.get('origin');
		if (requestOrigin && new URL(requestOrigin).origin !== resource.origin) {
			return withPrivateHeaders(Response.json({
				jsonrpc: '2.0', error: { code: -32000, message: 'Origin must match the configured MCP resource origin.' }, id: null,
			}, { status: 403 }));
		}
		const response = await authenticatedHandler(request);
		return withPrivateHeaders(response);
	};
}

function defaultJwksUrl(issuer: string) {
	const issuerUrl = new URL(issuer);
	const issuerPath = issuerUrl.pathname.replace(/\/+$/, '');
	return new URL(`${issuerPath}/jwks`, issuerUrl.origin).toString();
}

function withPrivateHeaders(response: Response) {
	const headers = new Headers(response.headers);
	headers.set('cache-control', 'private, no-store');
	headers.set('vary', 'Authorization, Origin, Host');
	return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
