/** Routes that must reach their own authentication/protocol handler unchanged. */
export function bypassesSessionProxy(pathname: string) {
	return pathname === '/api/auth'
		|| pathname.startsWith('/api/auth/')
		|| pathname === '/api/mcp'
		|| pathname === '/.well-known/oauth-authorization-server'
		|| pathname === '/.well-known/oauth-authorization-server/api/auth'
		|| pathname === '/.well-known/oauth-protected-resource'
		|| pathname === '/.well-known/oauth-protected-resource/api/mcp';
}
