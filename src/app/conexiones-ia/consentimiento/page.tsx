import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth-provider';
import { requireAuth } from '@/lib/auth';
import { verifyOAuthConsentQuery, type SearchParams } from '@/lib/oauth-consent-query';
import { submitOAuthConsent } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { referrer: 'no-referrer' as const };

const scopeLabels: Record<string, string> = {
	openid: 'Recibir una identidad de inicio de sesión seudónima',
	offline_access: 'Mantener la conexión activa entre sesiones',
	'finanzar:read': 'Consultar tus movimientos y resúmenes financieros',
	'finanzar:transactions:write': 'Proponer y aplicar cambios en gastos solo después de una confirmación explícita en Claude',
};
const CONNECTION_REVOCATION_READY = true;

export default async function AiConsentPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
	if (process.env.MCP_OAUTH_ENABLED !== 'true') notFound();
	const query = await searchParams;
	const oauthQuery = Object.entries(query)
		.flatMap(([key, value]) => (Array.isArray(value) ? value : value === undefined ? [] : [value]).map((item) => [key, item] as const))
		.filter(([key]) => !['error', 'configurado', 'oauth_query'].includes(key))
		.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
		.join('&');
	const { secret } = await auth.$context;
	const verified = await verifyOAuthConsentQuery(oauthQuery, secret);
	if (!verified) notFound();
	const session = await requireAuth();
	const clientId = verified.get('client_id')!;
	const client = await auth.api.getOAuthClientPublic({ headers: await headers(), query: { client_id: clientId } });
	if (!client) notFound();

	const scopes = (verified.get('scope') ?? '').split(/\s+/).filter(Boolean);
	const unsupportedScopes = scopes.filter((scope) => !scopeLabels[scope]);
	const claims = verified.get('claims');
	let requestedIdentityFields: string[] = [];
	if (claims) {
		try {
			const parsed = JSON.parse(claims) as Record<string, Record<string, unknown>>;
			requestedIdentityFields = Object.entries(parsed)
				.flatMap(([kind, values]) => Object.keys(values ?? {}).map((field) => `${kind}.${field}`));
		} catch { notFound(); }
	}

	const clientName = client.client_name || client.client_id || clientId;
	const returnQuery = verified.toString();
	return (
		<section className="mx-auto flex min-h-[65dvh] max-w-xl items-center justify-center py-8">
			<div className="w-full rounded-2xl border border-zinc-200 bg-white p-7 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 sm:p-8">
				<h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Conectar con {clientName}</h1>
				<p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
					Esta aplicación externa quiere conectarse a tu cuenta Finanzar. Revisá cada permiso antes de autorizar.
				</p>
				<dl className="mt-6 divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-700 dark:border-zinc-700">
					<div className="py-3">
						<dt className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Aplicación</dt>
						<dd className="mt-1 break-words font-medium text-zinc-900 dark:text-zinc-100">{clientName}</dd>
						{client.client_uri && <dd className="mt-1 break-all text-sm text-zinc-600 dark:text-zinc-400">{client.client_uri}</dd>}
					</div>
					<div className="py-3">
						<dt className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Cuenta Finanzar</dt>
						<dd className="mt-1 font-medium text-zinc-900 dark:text-zinc-100">{session.user.name}</dd>
					</div>
				</dl>
				<h2 className="mt-6 font-semibold text-zinc-900 dark:text-zinc-100">Permisos solicitados</h2>
				<ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
					{scopes.map((scope) => <li key={scope}>{scopeLabels[scope] ?? `Permiso no disponible: ${scope}`}</li>)}
					{requestedIdentityFields.map((field) => <li key={field}>Dato de perfil solicitado: {field}</li>)}
				</ul>
				<p className="mt-5 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
					Si aceptás, los datos financieros consultados se enviarán al proveedor de IA. Si autorizás cambios, la conexión también podrá aplicarlos después de una confirmación explícita en Claude. Podés desconectarla desde Finanzar.
				</p>
				{unsupportedScopes.length > 0 && <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200">Esta solicitud incluye permisos que Finanzar todavía no ofrece. No se puede aprobar.</p>}
				{!CONNECTION_REVOCATION_READY && <p role="status" className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:bg-amber-950/40 dark:text-amber-100">La autorización de conexiones nuevas todavía está deshabilitada mientras termina la verificación de seguridad.</p>}
				<form action={submitOAuthConsent} className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
					<input type="hidden" name="oauth_query" value={returnQuery} />
					<button name="decision" value="deny" className="min-h-11 rounded-lg border border-zinc-300 px-4 font-medium text-zinc-800 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-700">No conectar</button>
					<button name="decision" value="accept" disabled={unsupportedScopes.length > 0 || !CONNECTION_REVOCATION_READY} className="min-h-11 rounded-lg bg-blue-600 px-4 font-semibold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50">Autorizar acceso</button>
				</form>
			</div>
		</section>
	);
}
