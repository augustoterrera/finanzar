import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bypassesSessionProxy } from './proxy-path-policy';

test('only Better Auth and the self-authenticating MCP endpoint bypass the session proxy', () => {
	assert.equal(bypassesSessionProxy('/api/auth/.well-known/oauth-authorization-server'), true);
	assert.equal(bypassesSessionProxy('/api/auth/oauth2/token'), true);
	assert.equal(bypassesSessionProxy('/api/auth/login'), true);
	assert.equal(bypassesSessionProxy('/api/mcp'), true);
	assert.equal(bypassesSessionProxy('/.well-known/oauth-authorization-server'), true);
	assert.equal(bypassesSessionProxy('/.well-known/oauth-authorization-server/api/auth'), true);
	assert.equal(bypassesSessionProxy('/.well-known/oauth-protected-resource'), true);
	assert.equal(bypassesSessionProxy('/.well-known/oauth-protected-resource/api/mcp'), true);
	assert.equal(bypassesSessionProxy('/.well-known/oauth-authorization-server-evil'), false);
	assert.equal(bypassesSessionProxy('/.well-known/other'), false);
	assert.equal(bypassesSessionProxy('/api/mcp/other'), false);
	assert.equal(bypassesSessionProxy('/api/private-data'), false);
	assert.equal(bypassesSessionProxy('/api/authentication'), false);
});
