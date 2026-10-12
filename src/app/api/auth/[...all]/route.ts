import { toNextJsHandler } from 'better-auth/next-js';
import { auth } from '@/lib/auth-provider';
import { persistMcpGrantFromTokenResponse } from '@/lib/mcp-token-grants';
import { addMcpWriteScope } from '@/lib/oauth-mcp-write-scope';
import { db } from '@/db';

const handlers = toNextJsHandler(auth);
export const runtime = 'nodejs';
export async function GET(request: Request) {
	return handlers.GET(addMcpWriteScope(request, { oauthEnabled: process.env.MCP_OAUTH_ENABLED === 'true' }));
}

export async function POST(request: Request) {
	const response = await handlers.POST(request);
	if (!response.ok || !new URL(request.url).pathname.endsWith('/oauth2/token')) return response;
	const baseURL = process.env.BETTER_AUTH_URL ?? 'http://localhost:3000';
	const issuer = new URL('/api/auth', baseURL).toString();
	const resource = new URL('/api/mcp', baseURL).toString();
	try {
		await persistMcpGrantFromTokenResponse(db, response, { issuer, resource });
		return response;
	} catch {
		// Never deliver a newly minted MCP bearer token unless its revocation row
		// was durably written. The provider has already issued it, but no client
		// receives it when this response is replaced.
		return Response.json({ error: 'temporarily_unavailable' }, {
			status: 503,
			headers: { 'cache-control': 'no-store' },
		});
	}
}
