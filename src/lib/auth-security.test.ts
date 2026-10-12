import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import * as appSchema from '../db/schema';
import * as authSchema from '../db/auth-schema';
import { createFinanzarAuth } from './auth-config';
import { INITIAL_ACCOUNT_EMAIL, isValidUsername, USERNAME_PATTERN } from './auth-policy';
import { consumeSetupAttempt, SETUP_ATTEMPT_WINDOW_MS } from './auth-setup-limit';
import { copyAuthCookies } from './auth-cookies';
import { submitLoginForm } from './auth-login-form';
import { createInitialAccount } from './auth-initial-account';
import { verifyOAuthConsentQuery } from './oauth-consent-query';
import { handleOAuthWellKnownRequest } from './oauth-well-known';
import { hasActiveMcpAuthorization } from './mcp-authorization';
import { persistMcpGrantFromTokenResponse } from './mcp-token-grants';
import { createFinanzarMcpHttpHandler } from './mcp-http-handler';
import { getMonthlyExpenseLedgerSnapshot } from './expense-ledger-service';
import { decideMcpTransactionProposal } from './mcp-change-requests';

const origin = 'http://localhost:3000';
const setupToken = 'test-only-bootstrap-code-not-a-real-secret';
const password = 'Test-only-pass-12345678';
const username = 'augusto-test';
const mcpProtocolVersion = '2026-07-28';
const schema = { ...appSchema, ...authSchema };

async function fixture() {
	const client = createClient({ url: 'file::memory:' });
	for (const migration of ['0000_fluffy_diamondback.sql', '0001_seed_owner.sql', '0002_abnormal_chronomancer.sql', '0003_sad_grey_gargoyle.sql']) {
		await client.executeMultiple(readFileSync(new URL(`../../drizzle/${migration}`, import.meta.url), 'utf8'));
	}
	await client.executeMultiple(readFileSync(new URL('../../drizzle/0004_auth_accounts.sql', import.meta.url), 'utf8'));
	await client.executeMultiple(readFileSync(new URL('../../drizzle/0005_mcp_oauth.sql', import.meta.url), 'utf8'));
	await client.executeMultiple(readFileSync(new URL('../../drizzle/0006_private_ledger_owner.sql', import.meta.url), 'utf8'));
	await client.executeMultiple(readFileSync(new URL('../../drizzle/0007_mcp_access_grants.sql', import.meta.url), 'utf8'));
	await client.executeMultiple(readFileSync(new URL('../../drizzle/0008_sour_bloodstrike.sql', import.meta.url), 'utf8'));
	const database = drizzle(client, { schema });
	const auth = createFinanzarAuth(database as Parameters<typeof createFinanzarAuth>[0], {
		baseURL: origin, secret: 'test-only-session-secret-at-least-32-bytes-long',
		secureCookies: false, enableMcp: true, getSetupToken: () => setupToken,
	});
	const createOwner = (name = username) => createInitialAccount(auth, database as Parameters<typeof createInitialAccount>[1], {
		setupToken, username: name, password,
	});
	const jsonRequest = (path: string, body: Record<string, string>, extraHeaders: Record<string, string> = {}) => new Request(`${origin}/api/auth${path}`, {
		method: 'POST', headers: {
			'content-type': 'application/json', origin, 'x-vercel-forwarded-for': '203.0.113.10', ...extraHeaders,
		}, body: JSON.stringify(body),
	});
	const signIn = () => auth.handler(jsonRequest('/sign-in/username', { username, password }));
	return { client, database, auth, createOwner, jsonRequest, signIn };
}

test('username constraints match the server and HTML UnicodeSets pattern', () => {
	const browserRegex = new RegExp(`^(?:${USERNAME_PATTERN})$`, 'v');
	for (const value of ['augusto-test', 'Augusto.test_1', 'a'.repeat(32)]) {
		assert.equal(isValidUsername(value), true);
		assert.equal(browserRegex.test(value), true);
	}
	for (const value of ['ab', 'a'.repeat(33), 'a b', 'augusto@test', '']) {
		assert.equal(isValidUsername(value), false);
		assert.equal(browserRegex.test(value), false);
	}
	const form = readFileSync(new URL('../app/login/LoginForm.tsx', import.meta.url), 'utf8');
	assert.match(form, /<form method="post" action="\/api\/auth\/login"/);
});

test('hyphenated username can sign up and log in; public email login and signup stay closed', async () => {
	const f = await fixture();
	try {
		await f.createOwner();
		assert.equal((await f.signIn()).status, 200);
		assert.equal((await f.auth.handler(f.jsonRequest('/sign-in/email', { email: INITIAL_ACCOUNT_EMAIL, password }))).status, 404);
		assert.equal((await f.auth.handler(f.jsonRequest('/sign-up/email', { email: 'another@test.invalid', name: 'another', password }))).status, 404);
		assert.equal((await f.database.select().from(schema.user)).length, 1);
	} finally { f.client.close(); }
});

test('signup requires the setup code and the fixed singleton email', async () => {
	const f = await fixture();
	try {
		// Better Auth may return a synthetic response for denied registration;
		// the security invariant is that no real user/account is inserted.
		await f.auth.api.signUpEmail({ body: { email: INITIAL_ACCOUNT_EMAIL, name: username, username, password } });
		assert.equal((await f.database.select().from(schema.user)).length, 0);
		await assert.rejects(f.auth.api.signUpEmail({
			headers: new Headers({ 'x-finanzar-setup-token': setupToken }),
			body: { email: 'other@test.invalid', name: username, username, password },
		}));
		assert.equal((await f.database.select().from(schema.user)).length, 0);
	} finally { f.client.close(); }
});

test('concurrent bootstrap creates exactly one account and repeat setup fails', async () => {
	const f = await fixture();
	try {
		const results = await Promise.allSettled([f.createOwner('first-owner'), f.createOwner('second-owner')]);
		assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
		assert.equal((await f.database.select().from(schema.user)).length, 1);
		assert.equal((await f.database.select().from(schema.account)).length, 1);
		assert.equal((await f.database.select().from(schema.ledger_accounts)).length, 1);
		await assert.rejects(f.createOwner('third-owner'));
	} finally { f.client.close(); }
});

test('credential creation failure rolls back the user rather than locking setup', async () => {
	const f = await fixture();
	try {
		await f.client.execute("CREATE TRIGGER reject_test_account BEFORE INSERT ON account BEGIN SELECT RAISE(ABORT, 'test failure'); END");
		await assert.rejects(f.createOwner());
		assert.equal((await f.database.select().from(schema.user)).length, 0);
		assert.equal((await f.database.select().from(schema.account)).length, 0);
		await f.client.execute('DROP TRIGGER reject_test_account');
		await f.createOwner();
		assert.equal((await f.signIn()).status, 200);
	} finally { f.client.close(); }
});

test('setup attempts are limited atomically, persist across callers and reset after 15 minutes', async () => {
	const f = await fixture();
	try {
		const database = f.database as Parameters<typeof consumeSetupAttempt>[0];
		const now = Date.now();
		const results = await Promise.all(Array.from({ length: 12 }, () => consumeSetupAttempt(database, now)));
		assert.equal(results.filter(Boolean).length, 5);
		assert.equal(await consumeSetupAttempt(database, now + SETUP_ATTEMPT_WINDOW_MS - 1), false);
		assert.equal(await consumeSetupAttempt(database, now + SETUP_ATTEMPT_WINDOW_MS), true);
		const [row] = await f.database.select().from(schema.rateLimit);
		assert.equal(row.count, 1);
		const action = readFileSync(new URL('../app/login/actions.ts', import.meta.url), 'utf8');
		assert.ok(action.indexOf('await consumeSetupAttempt(db)') < action.indexOf('const setupToken ='));
	} finally { f.client.close(); }
});

test('username login locks after 8 attempts and email cannot bypass the block', async () => {
	const f = await fixture();
	try {
		await f.createOwner();
		for (let i = 0; i < 8; i++) {
			assert.equal((await f.auth.handler(f.jsonRequest('/sign-in/username', { username, password: 'wrong-password' }))).status, 401);
		}
		assert.equal((await f.signIn()).status, 429);
		assert.equal((await f.auth.handler(f.jsonRequest('/sign-in/email', { email: INITIAL_ACCOUNT_EMAIL, password }))).status, 404);
	} finally { f.client.close(); }
});

test('login rate limit keys on the Vercel IP header and ignores spoofed X-Forwarded-For', async () => {
	const f = await fixture();
	try {
		await f.createOwner();
		for (let i = 0; i < 8; i++) {
			const response = await f.auth.handler(f.jsonRequest('/sign-in/username', {
				username, password: 'wrong-password',
			}, {
				'x-vercel-forwarded-for': '203.0.113.40',
				'x-forwarded-for': `198.51.100.${i + 1}`,
			}));
			assert.equal(response.status, 401);
		}
		assert.equal((await f.auth.handler(f.jsonRequest('/sign-in/username', { username, password }, {
			'x-vercel-forwarded-for': '203.0.113.40', 'x-forwarded-for': '192.0.2.99',
		}))).status, 429, 'changing the untrusted forwarded header must not evade the bucket');
		assert.equal((await f.auth.handler(f.jsonRequest('/sign-in/username', { username, password }, {
			'x-vercel-forwarded-for': '203.0.113.41', 'x-forwarded-for': '192.0.2.99',
		}))).status, 200, 'a distinct platform-reported IP has an independent bucket');
	} finally { f.client.close(); }
});

function formRequest(submittedPassword = password, submittedOrigin = origin, oauthQuery?: string) {
	return new Request(`${origin}/api/auth/login`, {
		method: 'POST', headers: { origin: submittedOrigin, 'x-vercel-forwarded-for': '203.0.113.10' },
		body: new URLSearchParams({ username, password: submittedPassword, ...(oauthQuery ? { oauth_query: oauthQuery } : {}) }),
	});
}

test('native POST login works without JS, sets cookies, and never redirects credentials', async () => {
	const f = await fixture();
	try {
		await f.createOwner();
		const response = await submitLoginForm(f.auth, formRequest());
		assert.equal(response.status, 303);
		assert.equal(response.headers.get('location'), `${origin}/`);
		assert.ok(response.headers.getSetCookie().some(cookie => cookie.includes('session_token') && cookie.includes('HttpOnly')));
		assert.equal(response.headers.get('cache-control'), 'no-store');
		const invalid = await submitLoginForm(f.auth, formRequest('wrong-password'));
		assert.equal(invalid.headers.get('location'), `${origin}/login?error=credenciales`);
		assert.ok(!invalid.headers.get('location')?.includes('wrong-password'));
		assert.equal((await submitLoginForm(f.auth, formRequest(password, 'https://attacker.invalid'))).status, 403);
	} finally { f.client.close(); }
});

test('native login shares the same attempt bucket with the JS endpoint', async () => {
	const f = await fixture();
	try {
		await f.createOwner();
		for (let i = 0; i < 8; i++) {
			assert.equal((await submitLoginForm(f.auth, formRequest('wrong-password'))).headers.get('location'), `${origin}/login?error=credenciales`);
		}
		assert.equal((await f.signIn()).status, 429);
		assert.equal((await submitLoginForm(f.auth, formRequest())).headers.get('location'), `${origin}/login?error=limite`);
	} finally { f.client.close(); }
});

test('session renewal forwards cookies; read-only checks do not renew or lose cookies', async () => {
	const f = await fixture();
	try {
		await f.createOwner();
		const login = await f.signIn();
		const cookie = login.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
		const [original] = await f.database.select().from(schema.session);
		const oldExpiry = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000);
		await f.database.update(schema.session).set({ expiresAt: oldExpiry }).where(eq(schema.session.id, original.id));
		const clientHeaders = new Headers({ cookie, 'x-vercel-forwarded-for': '203.0.113.10' });
		const readOnly = await f.auth.api.getSession({ headers: clientHeaders, query: { disableRefresh: true }, returnHeaders: true });
		assert.equal(readOnly.response?.session.expiresAt.getTime(), oldExpiry.getTime());
		assert.equal(readOnly.headers.getSetCookie().length, 0);
		const renewed = await f.auth.api.getSession({ headers: clientHeaders, returnHeaders: true });
		assert.ok(renewed.response!.session.expiresAt > oldExpiry);
		const response = copyAuthCookies(renewed.headers, NextResponse.next());
		assert.ok(response.headers.getSetCookie().some(value => value.includes('session_token') && value.includes('HttpOnly') && value.includes('Max-Age=604800')));
		assert.ok(response.headers.has('x-middleware-set-cookie'));
		const signOut = await f.auth.handler(new Request(`${origin}/api/auth/sign-out`, {
			method: 'POST', headers: { cookie, origin, 'x-vercel-forwarded-for': '203.0.113.10' },
		}));
		assert.equal(signOut.status, 200);
		assert.equal(await f.auth.api.getSession({ headers: clientHeaders }), null);
	} finally { f.client.close(); }
});

test('MCP authorization discovery and signing keys are served from the isolated auth schema', async () => {
	const f = await fixture();
	try {
		const discovery = await f.auth.handler(new Request(`${origin}/api/auth/.well-known/oauth-authorization-server`));
		assert.equal(discovery.status, 200);
		const metadata = await discovery.json();
		assert.equal(metadata.issuer, `${origin}/api/auth`);
		assert.ok(metadata.authorization_endpoint.endsWith('/oauth2/authorize'));
		assert.ok(!metadata.registration_endpoint, 'anonymous DCR must remain disabled');

		const rootMetadataResponse = await handleOAuthWellKnownRequest(
			new Request(`${origin}/.well-known/oauth-authorization-server`),
			(request) => f.auth.handler(request),
		);
		assert.equal(rootMetadataResponse.status, 200, 'Claude-compatible root discovery must reach Better Auth');
		assert.equal((await rootMetadataResponse.json()).issuer, `${origin}/api/auth`);

		const resourceMetadataResponse = await handleOAuthWellKnownRequest(
			new Request(`${origin}/.well-known/oauth-protected-resource/api/mcp`),
			(request) => f.auth.handler(request),
		);
		assert.equal(resourceMetadataResponse.status, 200);
		const resourceMetadata = await resourceMetadataResponse.json();
		assert.equal(resourceMetadata.resource, `${origin}/api/mcp`);
		assert.deepEqual(resourceMetadata.authorization_servers, [`${origin}/api/auth`]);

		const jwks = await f.auth.handler(new Request(`${origin}/api/auth/jwks`));
		assert.equal(jwks.status, 200);
		assert.ok(Array.isArray((await jwks.json()).keys));
	} finally { f.client.close(); }
});

test('OAuth login preserves the signed consent request and completes the PKCE token exchange', async () => {
	const f = await fixture();
	const originalFetch = globalThis.fetch;
	try {
		const owner = await f.createOwner();
		await f.database.insert(appSchema.people).values({ id: 'mcp-leo', name: 'Leo' });
		await f.database.insert(appSchema.cards).values({ id: 'mcp-card', name: 'Naranja', owner_person_id: 'owner_1' });
		await f.database.insert(appSchema.payment_methods).values({ id: 'mcp-payment', name: 'Tarjeta Naranja', type: 'credit_card', card_id: 'mcp-card' });
		await f.database.insert(appSchema.transactions).values({
			id: 'mcp-transaction', type: 'expense', date: '2026-10-10', month: '2026-10', amount: 12_345,
			description: 'Compra fixture', payer_person_id: 'owner_1', payment_method_id: 'mcp-payment', card_id: 'mcp-card', status: 'active',
		});
		await f.database.insert(appSchema.transaction_splits).values({ id: 'mcp-split', transaction_id: 'mcp-transaction', person_id: 'mcp-leo', amount: 12_345 });
		await f.database.insert(appSchema.cards).values({ id: 'mcp-icbc', name: 'ICBC', owner_person_id: 'owner_1', color: '#dc2626' });
		await f.database.insert(appSchema.payment_methods).values({ id: 'mcp-payment-icbc', name: 'Tarjeta ICBC', type: 'credit_card', card_id: 'mcp-icbc' });
		await f.database.insert(appSchema.transactions).values([
			{ id: 'mcp-shared', type: 'expense', date: '2026-10-11', month: '2026-10', amount: 888_867, description: 'Compra compartida', payer_person_id: 'owner_1', payment_method_id: 'mcp-payment', card_id: 'mcp-card', status: 'active' },
			{ id: 'mcp-icbc-transaction', type: 'expense', date: '2026-10-12', month: '2026-10', amount: 134_825, description: 'Compra ICBC', payer_person_id: 'owner_1', payment_method_id: 'mcp-payment-icbc', card_id: 'mcp-icbc', status: 'active' },
		]);
		await f.database.insert(appSchema.transaction_splits).values([
			{ id: 'mcp-shared-owner', transaction_id: 'mcp-shared', person_id: 'owner_1', amount: 444_434 },
			{ id: 'mcp-shared-leo', transaction_id: 'mcp-shared', person_id: 'mcp-leo', amount: 444_433 },
			{ id: 'mcp-icbc-split', transaction_id: 'mcp-icbc-transaction', person_id: 'owner_1', amount: 134_825 },
		]);
		const initialLogin = await f.signIn();
		const sessionCookie = initialLogin.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
		const redirectUri = 'http://127.0.0.1:4010/oauth/callback';
		const client = await f.auth.api.createOAuthClient({
			headers: new Headers({ cookie: sessionCookie }),
			body: {
				redirect_uris: [redirectUri], client_name: 'Prueba MCP Finanzar', application_type: 'native',
				token_endpoint_auth_method: 'none', grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'],
			},
		});
		const verifier = 'finanzar-test-pkce-verifier-which-is-long-enough';
		const challengeBytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
		const challenge = Buffer.from(challengeBytes).toString('base64url');
		const oauthParams = new URLSearchParams({
			client_id: client.client_id, redirect_uri: redirectUri, response_type: 'code',
			scope: 'openid offline_access finanzar:read finanzar:transactions:write', code_challenge: challenge,
			code_challenge_method: 'S256', resource: `${origin}/api/mcp`, state: 'state-test',
		});
		const authorization = await f.auth.handler(new Request(`${origin}/api/auth/oauth2/authorize?${oauthParams}`));
		assert.equal(authorization.status, 302);
		const loginLocation = new URL(authorization.headers.get('location')!, origin);
		assert.equal(loginLocation.pathname, '/login');
		const oauthQuery = loginLocation.search.slice(1);
		assert.ok(oauthQuery.includes('sig='));

		const login = await submitLoginForm(f.auth, formRequest(password, origin, oauthQuery));
		const consentLocation = new URL(login.headers.get('location')!, origin);
		assert.equal(consentLocation.pathname, '/conexiones-ia/consentimiento');
		assert.equal((await verifyOAuthConsentQuery(consentLocation.search.slice(1), 'test-only-session-secret-at-least-32-bytes-long'))?.get('client_id'), client.client_id);
		const oauthCookie = login.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
		const consent = await f.auth.handler(new Request(`${origin}/api/auth/oauth2/consent`, {
			method: 'POST', headers: { cookie: oauthCookie, origin, 'content-type': 'application/json', accept: 'application/json' },
			body: JSON.stringify({ accept: true, oauth_query: consentLocation.search.slice(1) }),
		}));
		assert.equal(consent.status, 200);
		const consentResult = await consent.json();
		const callback = new URL(consentResult.url);
		assert.equal(callback.origin + callback.pathname, redirectUri);
		assert.equal(callback.searchParams.get('state'), 'state-test');
		const code = callback.searchParams.get('code');
		assert.ok(code);

		const tokenResponse = await f.auth.handler(new Request(`${origin}/api/auth/oauth2/token`, {
			method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', origin },
			body: new URLSearchParams({
				grant_type: 'authorization_code', code: code!, redirect_uri: redirectUri,
				client_id: client.client_id, code_verifier: verifier, resource: `${origin}/api/mcp`,
			}),
		}));
		assert.equal(tokenResponse.status, 200);
		assert.equal(await persistMcpGrantFromTokenResponse(f.database as Parameters<typeof persistMcpGrantFromTokenResponse>[0], tokenResponse, {
			issuer: `${origin}/api/auth`, resource: `${origin}/api/mcp`,
		}), true);
		const token = await tokenResponse.json();
		assert.equal(typeof token.access_token, 'string');
		assert.ok(token.access_token.length > 20);
		assert.equal((await f.database.select().from(schema.oauthConsent)).length, 1);
		const claims = JSON.parse(Buffer.from(token.access_token.split('.')[1], 'base64url').toString('utf8')) as { jti: string };
		assert.equal(await hasActiveMcpAuthorization(f.database as Parameters<typeof hasActiveMcpAuthorization>[0], {
			jti: claims.jti, subject: owner.id, clientId: client.client_id,
		}), true, 'issued token must map to an active durable consent');

		const jwksResponse = await f.auth.handler(new Request(`${origin}/api/auth/jwks`));
		const jwksBody = await jwksResponse.text();
		const testJwksUrl = `${origin}/api/auth/jwks`;
		globalThis.fetch = async (input, init) => {
			if (String(input) === testJwksUrl) {
				return new Response(jwksBody, { status: jwksResponse.status, headers: { 'content-type': 'application/json' } });
			}
			return originalFetch(input, init);
		};
		const handleMcp = createFinanzarMcpHttpHandler(f.auth, f.database as Parameters<typeof createFinanzarMcpHttpHandler>[1], {
			resource: `${origin}/api/mcp`, issuer: `${origin}/api/auth`, enabled: () => true,
		});
		const makeMcpRequest = (
			body: { jsonrpc: string; id: number; method: string; params?: Record<string, unknown> },
			accessToken?: string,
			headerOverrides: Record<string, string> = {},
		) => {
			const params = body.params ?? {};
			return new Request(`${origin}/api/mcp`, {
			method: 'POST',
			headers: {
				host: new URL(origin).host,
				'content-type': 'application/json', accept: 'application/json, text/event-stream',
				'mcp-protocol-version': mcpProtocolVersion,
				'mcp-method': body.method,
				...(typeof params.name === 'string' ? { 'mcp-name': params.name } : {}),
				...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
				...headerOverrides,
			},
			body: JSON.stringify({ ...body, params: {
				...params,
				_meta: {
					'io.modelcontextprotocol/protocolVersion': mcpProtocolVersion,
					'io.modelcontextprotocol/clientInfo': { name: 'Finanzar test client', version: '1.0.0' },
					'io.modelcontextprotocol/clientCapabilities': {},
					...((params._meta as Record<string, unknown> | undefined) ?? {}),
				},
			} }),
			});
		};
		const unauthenticated = await handleMcp(makeMcpRequest({ jsonrpc: '2.0', id: 1, method: 'tools/list' }));
		assert.equal(unauthenticated.status, 401);
		assert.match(unauthenticated.headers.get('www-authenticate') ?? '', /Bearer/i);
		assert.equal(unauthenticated.headers.get('cache-control'), 'private, no-store');
		const sameOrigin = await handleMcp(makeMcpRequest({ jsonrpc: '2.0', id: 10, method: 'tools/list' }, undefined, { origin }));
		assert.equal(sameOrigin.status, 401, 'same-origin browser requests proceed to OAuth authentication');
		const invalidHost = await handleMcp(makeMcpRequest({ jsonrpc: '2.0', id: 11, method: 'tools/list' }, undefined, { host: 'attacker.invalid' }));
		assert.equal(invalidHost.status, 403);
		assert.equal(invalidHost.headers.get('cache-control'), 'private, no-store');
		const invalidOrigin = await handleMcp(makeMcpRequest({ jsonrpc: '2.0', id: 12, method: 'tools/list' }, undefined, { origin: 'https://attacker.invalid' }));
		assert.equal(invalidOrigin.status, 403);
		const opaqueOrigin = await handleMcp(makeMcpRequest({ jsonrpc: '2.0', id: 14, method: 'tools/list' }, undefined, { origin: 'null' }));
		assert.equal(opaqueOrigin.status, 403, 'opaque browser origins fail closed');
		const wrongSchemeOrigin = await handleMcp(makeMcpRequest({ jsonrpc: '2.0', id: 13, method: 'tools/list' }, undefined, { origin: 'https://localhost:3000' }));
		assert.equal(wrongSchemeOrigin.status, 403, 'origin must match the configured scheme and port, not only the hostname');
		const invalidToken = await handleMcp(makeMcpRequest({ jsonrpc: '2.0', id: 9, method: 'tools/list' }, 'not-a-valid-jwt'));
		assert.equal(invalidToken.status, 401);
		const oversized = await handleMcp(makeMcpRequest({
			jsonrpc: '2.0', id: 15, method: 'tools/list', params: { padding: 'x'.repeat(66 * 1024) },
		}, token.access_token));
		assert.equal(oversized.status, 413);
		assert.match(await oversized.text(), /Payload Too Large/);

		const discovery = await handleMcp(makeMcpRequest({ jsonrpc: '2.0', id: 2, method: 'server/discover' }, token.access_token));
		assert.equal(discovery.status, 200, await discovery.clone().text());
		assert.equal((await discovery.json() as { error?: unknown }).error, undefined);

		const toolList = await handleMcp(makeMcpRequest({ jsonrpc: '2.0', id: 3, method: 'tools/list' }, token.access_token));
		assert.equal(toolList.status, 200, await toolList.clone().text());
		const listed = await toolList.json() as { result?: { tools?: Array<{ name: string }> } };
		assert.ok(listed.result?.tools?.some((tool) => tool.name === 'finanzar_search_transactions'));
		assert.ok(listed.result?.tools?.some((tool) => tool.name === 'finanzar_apply_confirmed_change'));
		assert.ok(listed.result?.tools?.some((tool) => tool.name === 'finanzar_propose_update_installment_group'));

		const query = await handleMcp(makeMcpRequest({
			jsonrpc: '2.0', id: 4, method: 'tools/call',
			params: { name: 'finanzar_search_transactions', arguments: { month: '2026-10', person_id: 'mcp-leo', description_contains: 'Compra fixture', limit: 10 } },
		}, token.access_token));
		assert.equal(query.status, 200, await query.clone().text());
		const queryEnvelope = await query.json() as { result?: { content?: Array<{ text?: string }> } };
		const queryResult = JSON.parse(queryEnvelope.result?.content?.[0]?.text ?? '{}') as { total_matching_records: number; records: Array<{ id: string; amount_cents: number }> };
		assert.equal(queryResult.total_matching_records, 1);
		assert.deepEqual(queryResult.records.map((row) => [row.id, row.amount_cents]), [['mcp-transaction', 12_345]]);

		const monthlySummary = await handleMcp(makeMcpRequest({
			jsonrpc: '2.0', id: 18, method: 'tools/call',
			params: { name: 'finanzar_get_month_summary', arguments: { month: '2026-10' } },
		}, token.access_token));
		const monthlySummaryEnvelope = await monthlySummary.json() as { result?: { content?: Array<{ text?: string }> } };
		const mcpMonth = JSON.parse(monthlySummaryEnvelope.result?.content?.[0]?.text ?? '{}') as {
			income_cents: number; owner_expenses_cents: number;
			totals_by_person_and_card: Array<{ person: string; card: string; transactions_count: number; total_cents: number }>;
		};
		const dashboardMonth = await getMonthlyExpenseLedgerSnapshot(
			f.database as Parameters<typeof getMonthlyExpenseLedgerSnapshot>[0], owner.id, '2026-10',
		);
		const expectedLedgers = dashboardMonth.ledgers.map((ledger) => [ledger.personName, ledger.cardName, ledger.items.length, ledger.total]);
		const actualLedgers = mcpMonth.totals_by_person_and_card.map((ledger) => [ledger.person, ledger.card, ledger.transactions_count, ledger.total_cents]);
		assert.equal(mcpMonth.income_cents, dashboardMonth.income);
		assert.equal(mcpMonth.owner_expenses_cents, dashboardMonth.ownerExpenses);
		assert.deepEqual(actualLedgers, expectedLedgers, 'MCP must match the ledger amounts and groups rendered by the dashboard');

		const proposalArgs = {
			idempotency_key: 'test-create-expense-0001', type: 'expense', date: '2026-10-16', amount_cents: 12_000,
			description: 'Gasto aprobado por IA', payer_person_id: 'owner_1', payment_method_id: 'mcp-payment-icbc',
			responsibilities: [{ person_id: 'owner_1', amount_cents: 12_000 }], installments_total: 1, starting_installment: 1,
		};
		const propose = (id: number, args: Record<string, unknown>) => handleMcp(makeMcpRequest({
			jsonrpc: '2.0', id, method: 'tools/call',
			params: { name: 'finanzar_propose_create_transaction', arguments: args },
		}, token.access_token));
		const beforeProposalCount = (await f.database.select().from(appSchema.transactions)).length;
		const firstProposalResponse = await propose(20, proposalArgs);
		assert.equal(firstProposalResponse.status, 200, await firstProposalResponse.clone().text());
		const firstProposalEnvelope = await firstProposalResponse.json() as { result?: { content?: Array<{ text?: string }> } };
		const firstProposal = JSON.parse(firstProposalEnvelope.result?.content?.[0]?.text ?? '{}') as {
			proposal_id: string; state: string; reused: boolean; requires_explicit_user_confirmation: boolean;
		};
		assert.equal(firstProposal.state, 'pending', JSON.stringify(firstProposalEnvelope));
		assert.equal(firstProposal.reused, false);
		assert.equal(firstProposal.requires_explicit_user_confirmation, true);
		assert.equal((await f.database.select().from(appSchema.transactions)).length, beforeProposalCount,
			'proposing a movement must not write it to the ledger');

		const replayResponse = await propose(21, proposalArgs);
		const replayEnvelope = await replayResponse.json() as { result?: { content?: Array<{ text?: string }> } };
		const replay = JSON.parse(replayEnvelope.result?.content?.[0]?.text ?? '{}') as { proposal_id: string; reused: boolean };
		assert.equal(replay.proposal_id, firstProposal.proposal_id);
		assert.equal(replay.reused, true);
		assert.equal((await f.database.select().from(appSchema.ai_change_requests)).length, 1);

		const conflictingReplay = await propose(22, { ...proposalArgs, description: 'Otro gasto con la misma clave' });
		const conflictEnvelope = await conflictingReplay.json() as { result?: { isError?: boolean; content?: Array<{ text?: string }> } };
		assert.equal(conflictEnvelope.result?.isError, true);
		assert.equal(JSON.parse(conflictEnvelope.result?.content?.[0]?.text ?? '{}').error.code, 'IDEMPOTENCY_CONFLICT');

		const cancelledProposalResponse = await propose(23, {
			...proposalArgs, idempotency_key: 'test-create-expense-0002', description: 'Propuesta para cancelar',
		});
		const cancelledProposalEnvelope = await cancelledProposalResponse.json() as { result?: { content?: Array<{ text?: string }> } };
		const cancelledProposal = JSON.parse(cancelledProposalEnvelope.result?.content?.[0]?.text ?? '{}') as { proposal_id: string };
		const getProposalResponse = await handleMcp(makeMcpRequest({
			jsonrpc: '2.0', id: 24, method: 'tools/call',
			params: { name: 'finanzar_get_change_request', arguments: { proposal_id: cancelledProposal.proposal_id } },
		}, token.access_token));
		const getProposalEnvelope = await getProposalResponse.json() as { result?: { content?: Array<{ text?: string }> } };
		assert.equal(JSON.parse(getProposalEnvelope.result?.content?.[0]?.text ?? '{}').state, 'pending');
		const cancelProposalResponse = await handleMcp(makeMcpRequest({
			jsonrpc: '2.0', id: 25, method: 'tools/call',
			params: { name: 'finanzar_cancel_change_request', arguments: { proposal_id: cancelledProposal.proposal_id } },
		}, token.access_token));
		const cancelProposalEnvelope = await cancelProposalResponse.json() as { result?: { content?: Array<{ text?: string }> } };
		assert.equal(JSON.parse(cancelProposalEnvelope.result?.content?.[0]?.text ?? '{}').state, 'cancelled');
		assert.equal((await f.database.select().from(appSchema.transactions)).length, beforeProposalCount,
			'cancelling a proposal must not write to the financial ledger');

		const proposalDatabase = f.database as Parameters<typeof decideMcpTransactionProposal>[0];
		const decisionInput = {
			ownerUserId: owner.id, approvedByUserId: owner.id, proposalId: firstProposal.proposal_id,
		};
		await f.database.update(schema.oauthConsent).set({ scopes: ['finanzar:read'] });
		await assert.rejects(decideMcpTransactionProposal(proposalDatabase, decisionInput), /revocada|permiso/i);
		assert.equal((await f.database.select().from(appSchema.transactions)).length, beforeProposalCount,
			'revoked write consent must prevent the owner action from applying the proposal');
		await f.database.update(schema.oauthConsent).set({ scopes: ['finanzar:read', 'finanzar:transactions:write'] });
		const applied = await decideMcpTransactionProposal(proposalDatabase, decisionInput);
		assert.equal((await f.database.select().from(appSchema.transactions)).length, beforeProposalCount + 1);
		assert.equal((await f.database.select().from(appSchema.ai_change_requests))[0].state, 'applied');
		const repeatedApproval = await decideMcpTransactionProposal(proposalDatabase, decisionInput);
		assert.deepEqual(repeatedApproval, applied, 'a retried approval must return the original result without a duplicate write');
		assert.equal((await f.database.select().from(appSchema.transactions)).length, beforeProposalCount + 1);
		const proposalActions = readFileSync(new URL('../app/conexiones-ia/cambios/actions.ts', import.meta.url), 'utf8');
		assert.match(proposalActions, /approveMcpTransactionProposal[\s\S]*?requireAuth\(\)/);

		const missingTransaction = await handleMcp(makeMcpRequest({
			jsonrpc: '2.0', id: 16, method: 'tools/call',
			params: { name: 'finanzar_get_transaction', arguments: { transaction_id: 'does-not-exist' } },
		}, token.access_token));
		const missingResult = (await missingTransaction.json() as { result?: { isError?: boolean; content?: Array<{ text?: string }> } }).result;
		assert.equal(missingResult?.isError, true);
		assert.deepEqual(JSON.parse(missingResult?.content?.[0]?.text ?? '{}'), {
			error: { code: 'NOT_FOUND', message: 'No se encontró el movimiento solicitado.' },
		});

		const invalidCursor = await handleMcp(makeMcpRequest({
			jsonrpc: '2.0', id: 17, method: 'tools/call',
			params: { name: 'finanzar_search_transactions', arguments: { cursor: 'not-a-valid-cursor' } },
		}, token.access_token));
		const invalidCursorResult = (await invalidCursor.json() as { result?: { isError?: boolean; content?: Array<{ text?: string }> } }).result;
		assert.equal(invalidCursorResult?.isError, true);
		const invalidCursorError = JSON.parse(invalidCursorResult?.content?.[0]?.text ?? '{}') as { error: { code: string; message: string } };
		assert.equal(invalidCursorError.error.code, 'VALIDATION_ERROR');
		assert.match(invalidCursorError.error.message, /cursor no es válido/);

		const updateProposalResponse = await handleMcp(makeMcpRequest({
			jsonrpc: '2.0', id: 26, method: 'tools/call',
			params: {
				name: 'finanzar_propose_update_transaction',
				arguments: {
					idempotency_key: 'test-update-transaction-01', transaction_id: 'mcp-transaction',
					date: '2026-10-10', impact_month: '2026-10', amount_cents: 13_000,
					description: 'Compra fixture corregida', payer_person_id: 'owner_1',
					payment_method_id: 'mcp-payment', responsibilities: [{ person_id: 'mcp-leo', amount_cents: 13_000 }],
				},
			},
		}, token.access_token));
		assert.equal(updateProposalResponse.status, 200, await updateProposalResponse.clone().text());
		const updateEnvelope = await updateProposalResponse.json() as { result?: { content?: Array<{ text?: string }> } };
		const update = JSON.parse(updateEnvelope.result?.content?.[0]?.text ?? '{}') as {
			proposal_id: string; state: string; preview: { kind: string; before: { amount_cents: number }; after: { amount_cents: number } };
		};
		assert.equal(update.state, 'pending');
		assert.equal(update.preview.kind, 'update_transaction');
		assert.equal(update.preview.before.amount_cents, 12_345);
		assert.equal(update.preview.after.amount_cents, 13_000);
		assert.equal((updateEnvelope.result?.content?.[0]?.text ?? '').includes('en este chat'), true);
		assert.equal((await f.database.select().from(appSchema.transactions)
			.where(eq(appSchema.transactions.id, 'mcp-transaction')))[0].amount, 12_345,
			'MCP update proposal must not modify the transaction before confirmation');
		const invalidConfirmation = await handleMcp(makeMcpRequest({
			jsonrpc: '2.0', id: 27, method: 'tools/call',
			params: { name: 'finanzar_apply_confirmed_change', arguments: { proposal_id: update.proposal_id, user_confirmed: 'yes' } },
		}, token.access_token));
		const invalidConfirmationBody = await invalidConfirmation.json() as { result?: { isError?: boolean } };
		assert.equal(invalidConfirmationBody.result?.isError, true, 'confirmation must use the strict affirmative schema');
		assert.equal((await f.database.select().from(appSchema.transactions)
			.where(eq(appSchema.transactions.id, 'mcp-transaction')))[0].amount, 12_345,
			'invalid confirmation must not write to the ledger');
		const applyUpdateResponse = await handleMcp(makeMcpRequest({
			jsonrpc: '2.0', id: 28, method: 'tools/call',
			params: {
				name: 'finanzar_apply_confirmed_change',
				arguments: { proposal_id: update.proposal_id, user_confirmed: true },
			},
		}, token.access_token));
		assert.equal(applyUpdateResponse.status, 200, await applyUpdateResponse.clone().text());
		const applyUpdateEnvelope = await applyUpdateResponse.json() as { result?: { isError?: boolean; content?: Array<{ text?: string }> } };
		assert.equal(applyUpdateEnvelope.result?.isError, undefined, applyUpdateEnvelope.result?.content?.[0]?.text);
		assert.equal((await f.database.select().from(appSchema.transactions)
			.where(eq(appSchema.transactions.id, 'mcp-transaction')))[0].amount, 13_000);
		const chatAudit = await f.database.select().from(appSchema.ai_audit_events)
			.where(eq(appSchema.ai_audit_events.change_request_id, update.proposal_id));
		assert.ok(chatAudit.some((event) => event.event_type === 'proposal_applied'
			&& event.metadata_json.includes('mcp_chat')));

		await f.database.update(appSchema.mcp_access_grants).set({ revoked_at: new Date() }).where(eq(appSchema.mcp_access_grants.jti, claims.jti));
		const revoked = await handleMcp(makeMcpRequest({ jsonrpc: '2.0', id: 5, method: 'tools/list' }, token.access_token));
		assert.equal(revoked.status, 401);
	} finally {
		globalThis.fetch = originalFetch;
		f.client.close();
	}
});
