import { and, eq, gt, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { oauthClient, oauthConsent } from '@/db/auth-schema';
import { mcp_access_grants } from '@/db/schema';
import { requireAuth } from '@/lib/auth';
import { revokeAiConnection } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { referrer: 'no-referrer' as const };

const scopeLabels: Record<string, string> = {
	openid: 'Identidad seudónima',
	offline_access: 'Conexión persistente',
	'finanzar:read': 'Lectura de movimientos y resúmenes',
	'finanzar:transactions:write': 'Proponer y aplicar cambios en gastos tras confirmación explícita en Claude',
};

function parseScopes(value: unknown): string[] {
	if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
	if (typeof value !== 'string') return [];
	try {
		const parsed: unknown = JSON.parse(value);
		return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
	} catch { return []; }
}

export default async function AiConnectionsPage() {
	if (process.env.MCP_OAUTH_ENABLED !== 'true') {
		return (
			<section className="mx-auto max-w-3xl space-y-3 py-4">
				<h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Conexiones con IA</h1>
				<p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">El acceso de clientes externos está apagado hasta completar la configuración segura de Finanzar.</p>
			</section>
		);
	}
	const session = await requireAuth();
	const consents = await db.select({
		clientId: oauthConsent.clientId,
		scopes: oauthConsent.scopes,
		updatedAt: oauthConsent.updatedAt,
		name: oauthClient.name,
		uri: oauthClient.uri,
	}).from(oauthConsent)
		.innerJoin(oauthClient, eq(oauthConsent.clientId, oauthClient.clientId))
		.where(eq(oauthConsent.userId, session.user.id))
		.orderBy(oauthConsent.updatedAt);
	const liveTokens = await db.select({ clientId: mcp_access_grants.client_id })
		.from(mcp_access_grants)
		.where(and(eq(mcp_access_grants.owner_user_id, session.user.id), isNull(mcp_access_grants.revoked_at), gt(mcp_access_grants.expires_at, new Date())));
	const activeClientIds = new Set(liveTokens.map((token) => token.clientId));

	return (
		<section className="mx-auto max-w-3xl space-y-6 py-4">
			<header>
				<h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Conexiones con IA</h1>
				<p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
					Revisá qué servicios pueden consultar Finanzar. Desconectar una aplicación invalida sus tokens de acceso y actualización.
				</p>
			</header>
			{consents.length ? (
				<div className="divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-700 dark:border-zinc-700">
					{consents.map((connection) => (
						<article key={connection.clientId} className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
							<div className="min-w-0">
								<h2 className="break-words font-semibold text-zinc-900 dark:text-zinc-100">{connection.name || connection.uri || 'Aplicación sin nombre'}</h2>
								<p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{activeClientIds.has(connection.clientId) ? 'Conexión activa' : 'Sin tokens de acceso vigentes'}</p>
								<ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-700 dark:text-zinc-300">
									{parseScopes(connection.scopes).map((scope) => <li key={scope}>{scopeLabels[scope] ?? scope}</li>)}
								</ul>
								<p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">Autorizada: {new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium' }).format(connection.updatedAt)}</p>
							</div>
							<form action={revokeAiConnection}>
								<input type="hidden" name="client_id" value={connection.clientId} />
								<button className="min-h-11 rounded-lg border border-zinc-300 px-4 font-medium text-zinc-800 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-700">Desconectar</button>
							</form>
						</article>
					))}
				</div>
			) : (
				<div className="border-y border-zinc-200 py-8 dark:border-zinc-700">
					<h2 className="font-semibold text-zinc-900 dark:text-zinc-100">No hay conexiones autorizadas</h2>
					<p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Cuando conectes un cliente compatible, vas a poder revisar y revocar sus permisos desde acá.</p>
				</div>
			)}
		</section>
	);
}
