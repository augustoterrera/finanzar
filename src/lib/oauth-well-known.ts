const WELL_KNOWN_PATHS = new Map([
	['/.well-known/oauth-authorization-server', '/api/auth/.well-known/oauth-authorization-server'],
	['/.well-known/oauth-authorization-server/api/auth', '/api/auth/.well-known/oauth-authorization-server'],
	['/.well-known/oauth-protected-resource', '/.well-known/oauth-protected-resource'],
	['/.well-known/oauth-protected-resource/api/mcp', '/.well-known/oauth-protected-resource/api/mcp'],
]);

export async function handleOAuthWellKnownRequest(
	request: Request,
	handleAuthRequest: (request: Request) => Promise<Response>,
) {
	const pathname = new URL(request.url).pathname;
	const targetPath = WELL_KNOWN_PATHS.get(pathname);
	if (!targetPath || (request.method !== 'GET' && request.method !== 'HEAD')) {
		return new Response(null, { status: 404, headers: { 'cache-control': 'private, no-store' } });
	}

	const target = new URL(request.url);
	target.pathname = targetPath;
	return handleAuthRequest(new Request(target, {
		method: request.method,
		headers: request.headers,
	}));
}
