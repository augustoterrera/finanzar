import { auth } from '@/lib/auth-provider';
import { db } from '@/db';
import { createFinanzarMcpHttpHandler } from '@/lib/mcp-http-handler';

export const runtime = 'nodejs';

export const POST = createFinanzarMcpHttpHandler(auth, db, {
	resource: new URL('/api/mcp', process.env.BETTER_AUTH_URL ?? 'http://localhost:3000').toString(),
	issuer: new URL('/api/auth', process.env.BETTER_AUTH_URL ?? 'http://localhost:3000').toString(),
	enabled: () => process.env.MCP_OAUTH_ENABLED === 'true',
});
