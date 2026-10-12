import { auth } from '@/lib/auth-provider';
import { handleOAuthWellKnownRequest } from '@/lib/oauth-well-known';

export const runtime = 'nodejs';

export function GET(request: Request) {
	return handleOAuthWellKnownRequest(request, (authRequest) => auth.handler(authRequest));
}

export function HEAD(request: Request) {
	return handleOAuthWellKnownRequest(request, (authRequest) => auth.handler(authRequest));
}
