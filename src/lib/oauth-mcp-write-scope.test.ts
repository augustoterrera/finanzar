import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addMcpWriteScope } from './oauth-mcp-write-scope';

const enabled = { oauthEnabled: true };

test('MCP OAuth explicitly requests write alongside read for owner consent', () => {
	const request = new Request('https://example.test/api/auth/oauth2/authorize?scope=openid%20offline_access%20finanzar%3Aread');
	const result = addMcpWriteScope(request, enabled);
	assert.deepEqual(new URL(result.url).searchParams.get('scope')?.split(' '), [
		'openid', 'offline_access', 'finanzar:read', 'finanzar:transactions:write',
	]);
});

test('write scope addition is idempotent and preserves unrelated requests', () => {
	const withWrite = new Request('https://example.test/api/auth/oauth2/authorize?scope=finanzar%3Aread%20finanzar%3Atransactions%3Awrite');
	assert.equal(addMcpWriteScope(withWrite, enabled), withWrite);
	const unrelated = new Request('https://example.test/api/auth/oauth2/token?scope=finanzar%3Aread');
	assert.equal(addMcpWriteScope(unrelated, enabled), unrelated);
	const notMcp = new Request('https://example.test/api/auth/oauth2/authorize?scope=openid');
	assert.equal(addMcpWriteScope(notMcp, enabled), notMcp);
});

test('disabled MCP does not add write scope', () => {
	const request = new Request('https://example.test/api/auth/oauth2/authorize?scope=finanzar%3Aread');
	assert.equal(addMcpWriteScope(request, { oauthEnabled: false }), request);
});
