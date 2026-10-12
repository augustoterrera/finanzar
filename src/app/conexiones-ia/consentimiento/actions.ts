'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth-provider';
import { requireAuth } from '@/lib/auth';
import { verifyOAuthConsentQuery } from '@/lib/oauth-consent-query';

const allowedScopes = new Set(['openid', 'offline_access', 'finanzar:read', 'finanzar:transactions:write']);
const CONNECTION_REVOCATION_READY = true;

export async function submitOAuthConsent(formData: FormData) {
	if (process.env.MCP_OAUTH_ENABLED !== 'true') throw new Error('Las conexiones de IA están deshabilitadas.');
	await requireAuth();
	const oauthQuery = formData.get('oauth_query');
	const decision = formData.get('decision');
	if (typeof oauthQuery !== 'string' || (decision !== 'accept' && decision !== 'deny')) throw new Error('Solicitud de autorización inválida.');
	const { secret } = await auth.$context;
	const params = await verifyOAuthConsentQuery(oauthQuery, secret);
	if (!params) throw new Error('La solicitud de autorización venció o no es válida. Volvé a conectar el cliente.');
	if (decision === 'accept' && !CONNECTION_REVOCATION_READY) throw new Error('Todavía no es posible autorizar conexiones nuevas.');

	const requestedScopes = (params.get('scope') ?? '').split(/\s+/).filter(Boolean);
	if (decision === 'accept' && (requestedScopes.some((scope) => !allowedScopes.has(scope)) || !requestedScopes.includes('finanzar:read'))) {
		throw new Error('El cliente pidió permisos no disponibles. No se concedió acceso.');
	}
	let claims: Record<string, unknown> | undefined;
	const rawClaims = params.get('claims');
	if (rawClaims) {
		try { claims = JSON.parse(rawClaims) as Record<string, unknown>; }
		catch { throw new Error('La solicitud de datos de identidad no es válida.'); }
	}

	const authHeaders = new Headers(await headers());
	authHeaders.set('content-type', 'application/json');
	authHeaders.set('accept', 'application/json');
	const authResponse = await auth.handler(new Request(new URL('/api/auth/oauth2/consent', auth.options.baseURL as string), {
		method: 'POST',
		headers: authHeaders,
		body: JSON.stringify({
			accept: decision === 'accept',
			oauth_query: params.toString(),
			...(decision === 'accept' ? { scope: requestedScopes.join(' '), ...(claims ? { claims } : {}) } : {}),
		}),
	}));
	if (!authResponse.ok) throw new Error('No se pudo completar la autorización. Volvé a iniciar la conexión.');
	const result = await authResponse.json() as { redirect?: boolean; url?: string };
	if (!result.redirect || !result.url) throw new Error('No se pudo completar la autorización.');
	redirect(result.url);
}
