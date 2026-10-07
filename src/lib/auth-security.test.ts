import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import * as schema from '../db/auth-schema';
import { createFinanzarAuth } from './auth-config';
import { INITIAL_ACCOUNT_EMAIL, isValidUsername, USERNAME_PATTERN } from './auth-policy';
import { consumeSetupAttempt, SETUP_ATTEMPT_WINDOW_MS } from './auth-setup-limit';
import { copyAuthCookies } from './auth-cookies';
import { submitLoginForm } from './auth-login-form';
import { createInitialAccount } from './auth-initial-account';

const origin = 'http://localhost:3000';
const setupToken = 'test-only-bootstrap-code-not-a-real-secret';
const password = 'Test-only-pass-12345678';
const username = 'augusto-test';

async function fixture() {
	const client = createClient({ url: 'file::memory:' });
	await client.executeMultiple(readFileSync(new URL('../../drizzle/0004_auth_accounts.sql', import.meta.url), 'utf8'));
	const database = drizzle(client, { schema });
	const auth = createFinanzarAuth(database as Parameters<typeof createFinanzarAuth>[0], {
		baseURL: origin, secret: 'test-only-session-secret-at-least-32-bytes-long',
		secureCookies: false, getSetupToken: () => setupToken,
	});
	const createOwner = (name = username) => createInitialAccount(auth, database as Parameters<typeof createInitialAccount>[1], {
		setupToken, username: name, password,
	});
	const jsonRequest = (path: string, body: Record<string, string>) => new Request(`${origin}/api/auth${path}`, {
		method: 'POST', headers: { 'content-type': 'application/json', origin }, body: JSON.stringify(body),
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

function formRequest(submittedPassword = password, submittedOrigin = origin) {
	return new Request(`${origin}/api/auth/login`, {
		method: 'POST', headers: { origin: submittedOrigin },
		body: new URLSearchParams({ username, password: submittedPassword }),
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
		const readOnly = await f.auth.api.getSession({ headers: new Headers({ cookie }), query: { disableRefresh: true }, returnHeaders: true });
		assert.equal(readOnly.response?.session.expiresAt.getTime(), oldExpiry.getTime());
		assert.equal(readOnly.headers.getSetCookie().length, 0);
		const renewed = await f.auth.api.getSession({ headers: new Headers({ cookie }), returnHeaders: true });
		assert.ok(renewed.response!.session.expiresAt > oldExpiry);
		const response = copyAuthCookies(renewed.headers, NextResponse.next());
		assert.ok(response.headers.getSetCookie().some(value => value.includes('session_token') && value.includes('HttpOnly') && value.includes('Max-Age=604800')));
		assert.ok(response.headers.has('x-middleware-set-cookie'));
		const signOut = await f.auth.handler(new Request(`${origin}/api/auth/sign-out`, { method: 'POST', headers: { cookie, origin } }));
		assert.equal(signOut.status, 200);
		assert.equal(await f.auth.api.getSession({ headers: new Headers({ cookie }) }), null);
	} finally { f.client.close(); }
});
