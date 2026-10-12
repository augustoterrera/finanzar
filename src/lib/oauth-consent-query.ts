import { verifyOAuthQueryParams } from '@better-auth/oauth-provider';

export type SearchParams = Record<string, string | string[] | undefined>;

export function serializeOAuthSearchParams(params: SearchParams) {
	const query = new URLSearchParams();
	for (const [key, value] of Object.entries(params)) {
		if (key === 'error' || key === 'configurado' || key === 'oauth_query' || value === undefined) continue;
		for (const item of Array.isArray(value) ? value : [value]) query.append(key, item);
	}
	return query.toString();
}

export async function verifyOAuthConsentQuery(query: string, secret: string) {
	if (!query || query.length > 16_384 || !(await verifyOAuthQueryParams(query, secret))) return null;
	const params = new URLSearchParams(query);
	if (!params.get('client_id') || !params.get('scope') || !params.get('sig')) return null;
	return params;
}

export function oauthConsentPath(query: string) {
	return `/conexiones-ia/consentimiento?${query}`;
}
