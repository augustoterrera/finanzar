const MCP_READ_SCOPE = 'finanzar:read';
const MCP_WRITE_SCOPE = 'finanzar:transactions:write';

/**
 * Claude currently requests only the read scope even when the MCP server
 * advertises write. Add write to the signed OAuth authorization request so the
 * owner can see and approve it on the consent page; every change still needs an
 * explicit confirmation before it is applied. Non-MCP requests are left untouched.
 */
export function addMcpWriteScope(request: Request, options: { oauthEnabled: boolean }) {
	if (!options.oauthEnabled) return request;
	const url = new URL(request.url);
	if (!url.pathname.endsWith('/oauth2/authorize')) return request;
	const requestedScopes = (url.searchParams.get('scope') ?? '').split(/\s+/).filter(Boolean);
	if (!requestedScopes.includes(MCP_READ_SCOPE) || requestedScopes.includes(MCP_WRITE_SCOPE)) return request;
	url.searchParams.set('scope', [...requestedScopes, MCP_WRITE_SCOPE].join(' '));
	return new Request(url, request);
}
