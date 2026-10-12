import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/db';
import { oauthClient } from '@/db/auth-schema';
import { requireAuth } from '@/lib/auth';
import { getMcpChangeRequest } from '@/lib/mcp-change-requests';
import { approveMcpTransactionProposal, rejectMcpTransactionProposalAction } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Revisar propuesta · Finanzar', referrer: 'no-referrer' as const };

type CreatePreview = {
	type: 'income' | 'expense';
	description: string;
	date: string;
	impact_month: string;
	amount_cents: number;
	purchase_total_cents: number;
	payer: { name: string };
	payment_method: { name: string };
	card: { name: string } | null;
	installments_total: number;
	installments_to_record: Array<{
		installment_number: number;
		date: string;
		month: string;
		amount_cents: number;
		responsibilities: Array<{ person: string; amount_cents: number }>;
	}>;
};

type UpdateState = {
	type: 'income' | 'expense';
	description: string;
	date: string;
	impact_month: string;
	amount_cents: number;
	payer: { id: string; name: string };
	payment_method: { id: string; name: string };
	card: { id: string; name: string } | null;
	responsibilities: Array<{ id: string; name: string; amount_cents: number }>;
};

type UpdatePreview = {
	kind: 'update_transaction';
	transaction_id: string;
	before: UpdateState;
	after: UpdateState;
};

const money = (cents: number) => new Intl.NumberFormat('es-AR', {
	style: 'currency', currency: 'ARS', minimumFractionDigits: 2,
}).format(cents / 100);

const date = (value: string | Date) => new Intl.DateTimeFormat('es-AR', {
	dateStyle: 'long', timeZone: 'UTC',
}).format(typeof value === 'string' ? new Date(`${value}T12:00:00Z`) : value);

const dateTime = (value: Date) => new Intl.DateTimeFormat('es-AR', {
	dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Argentina/Tucuman',
}).format(value);

const statusLabel: Record<string, string> = {
	pending: 'Pendiente de revisión', applied: 'Aprobada y aplicada', rejected: 'Rechazada',
	expired: 'Vencida', conflict: 'No se pudo aplicar por cambios en los datos',
};

const resultMessage: Record<string, string> = {
	aplicada: 'El movimiento quedó guardado en Finanzar.',
	actualizada: 'El movimiento fue actualizado en Finanzar.',
	rechazada: 'La propuesta fue rechazada. No se creó ningún movimiento.',
	vencida: 'La propuesta venció y no se aplicó. Pedile a la IA que genere una nueva.',
	'permiso-revocado': 'Se revocó el permiso de esa conexión. No se aplicó ningún movimiento.',
	'cambio-detectado': 'Los datos cambiaron desde la propuesta. No se aplicó; pedile a la IA una propuesta nueva.',
	'no-encontrada': 'No se encontró la propuesta.',
	error: 'No se pudo procesar la propuesta. No vuelvas a enviarla sin revisar el estado actual.',
};

function cardAndMethod(value: UpdateState) {
	return `${value.payment_method.name}${value.card ? ` · ${value.card.name}` : ''}`;
}

function responsibilities(value: UpdateState) {
	return value.responsibilities.map((person) => `${person.name} (${money(person.amount_cents)})`).join(' · ');
}

export default async function McpChangeRequestPage({
	params,
	searchParams,
}: {
	params: Promise<{ id: string }>;
	searchParams: Promise<{ resultado?: string }>;
}) {
	const session = await requireAuth();
	const [{ id }, query] = await Promise.all([params, searchParams]);
	if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
	const proposal = await getMcpChangeRequest(db, session.user.id, id);
	if (!proposal) notFound();
	const isUpdate = proposal.operation === 'update_transaction';
	const update = isUpdate ? proposal.preview as unknown as UpdatePreview : null;
	const create = isUpdate ? null : proposal.preview as unknown as CreatePreview;
	const [client] = await db.select({ name: oauthClient.name }).from(oauthClient)
		.where(eq(oauthClient.clientId, proposal.client_id)).limit(1);
	const isExpired = proposal.state === 'pending' && proposal.expires_at.getTime() <= Date.now();
	const canDecide = proposal.state === 'pending' && !isExpired;
	const outcomeMessage = query.resultado ? resultMessage[query.resultado] : null;

	return (
		<section className="mx-auto max-w-3xl space-y-6 py-4">
			<Link href="/conexiones-ia" className="text-sm font-medium text-zinc-600 underline decoration-zinc-300 underline-offset-4 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white">
				← Conexiones con IA
			</Link>
			<header className="space-y-2">
				<p className="text-sm font-medium text-orange-700 dark:text-orange-300">Revisión requerida · {client?.name || 'Aplicación conectada'}</p>
				<h1 className="text-2xl font-bold tracking-tight">{isUpdate ? 'Revisar edición' : 'Propuesta de movimiento'}</h1>
				<p className="max-w-prose text-sm leading-6 text-zinc-600 dark:text-zinc-400">
					{isUpdate
						? 'Compará el movimiento actual con el cambio propuesto. Nada cambia hasta que lo apruebes.'
						: 'Revisá todos los datos. El movimiento solo se guarda si elegís aprobarlo.'}
				</p>
			</header>

			{outcomeMessage && <p role="status" className="rounded-xl border border-zinc-200 bg-white p-4 text-sm leading-6 dark:border-zinc-700 dark:bg-zinc-800">{outcomeMessage}</p>}

			<article className="space-y-5 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 sm:p-6">
				<div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-200 pb-4 dark:border-zinc-700">
					<div>
						<p className="text-sm text-zinc-500 dark:text-zinc-400">{(update?.after.type ?? create?.type) === 'expense' ? 'Gasto' : 'Ingreso'}</p>
						<h2 className="mt-1 text-xl font-semibold">{update?.after.description ?? create?.description}</h2>
					</div>
					<span className={`rounded-full px-3 py-1 text-sm font-medium ${canDecide ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200' : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200'}`}>
						{isExpired ? statusLabel.expired : statusLabel[proposal.state] ?? 'Estado desconocido'}
					</span>
				</div>

				{update ? (
					<section aria-label="Comparación del movimiento">
						<div className="hidden grid-cols-[minmax(7rem,0.65fr)_1fr_1fr] gap-3 border-b border-zinc-200 pb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:border-zinc-700 dark:text-zinc-400 sm:grid">
							<span>Dato</span><span>Actual</span><span>Propuesto</span>
						</div>
						<dl className="divide-y divide-zinc-200 dark:divide-zinc-700">
							{([
								['Descripción', update.before.description, update.after.description],
								['Importe total', money(update.before.amount_cents), money(update.after.amount_cents)],
								['Fecha', date(update.before.date), date(update.after.date)],
								['Mes de impacto', update.before.impact_month, update.after.impact_month],
								['Paga', update.before.payer.name, update.after.payer.name],
								['Medio de pago', cardAndMethod(update.before), cardAndMethod(update.after)],
								['Responsables', responsibilities(update.before), responsibilities(update.after)],
							] as const).map(([label, before, after]) => {
								const changed = before !== after;
								return (
									<div key={label} className="grid gap-2 py-3 sm:grid-cols-[minmax(7rem,0.65fr)_1fr_1fr] sm:gap-3">
										<dt className="text-sm font-medium text-zinc-600 dark:text-zinc-300">{label}</dt>
										<div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-2 sm:block">
											<span className="text-xs text-zinc-500 dark:text-zinc-400 sm:hidden">Actual</span>
											<dd className="break-words text-sm">{before}</dd>
										</div>
										<div className={`grid grid-cols-[5rem_minmax(0,1fr)] gap-2 sm:block ${changed ? 'font-semibold text-zinc-900 dark:text-white' : 'text-zinc-600 dark:text-zinc-300'}`}>
											<span className="text-xs font-normal text-zinc-500 dark:text-zinc-400 sm:hidden">Propuesto</span>
											<dd className="break-words">{after}{changed && <span className="sr-only">, modificado</span>}</dd>
										</div>
									</div>
								);
							})}
						</dl>
						<p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">ID del movimiento: {update.transaction_id}</p>
					</section>
				) : create ? (
					<>
						<dl className="grid gap-4 sm:grid-cols-2">
							<div><dt className="text-sm text-zinc-500 dark:text-zinc-400">Importe total</dt><dd className="mt-1 text-lg font-semibold">{money(create.purchase_total_cents)}</dd></div>
							<div><dt className="text-sm text-zinc-500 dark:text-zinc-400">Fecha de carga</dt><dd className="mt-1 font-medium">{date(create.date)}</dd></div>
							<div><dt className="text-sm text-zinc-500 dark:text-zinc-400">Paga</dt><dd className="mt-1 font-medium">{create.payer.name}</dd></div>
							<div><dt className="text-sm text-zinc-500 dark:text-zinc-400">Medio de pago</dt><dd className="mt-1 font-medium">{create.payment_method.name}{create.card ? ` · ${create.card.name}` : ''}</dd></div>
							<div><dt className="text-sm text-zinc-500 dark:text-zinc-400">Cuotas</dt><dd className="mt-1 font-medium">{create.installments_total}</dd></div>
							<div><dt className="text-sm text-zinc-500 dark:text-zinc-400">Primer mes de impacto</dt><dd className="mt-1 font-medium">{create.impact_month}</dd></div>
						</dl>
						<div>
							<h3 className="font-semibold">Movimientos que se crearían</h3>
							<ul className="mt-3 divide-y divide-zinc-200 rounded-xl border border-zinc-200 dark:divide-zinc-700 dark:border-zinc-700">
								{create.installments_to_record.map((installment) => (
									<li key={`${installment.installment_number}-${installment.date}`} className="space-y-2 p-4">
										<div className="flex flex-wrap justify-between gap-2">
											<span className="font-medium">{create.installments_total > 1 ? `Cuota ${installment.installment_number}/${create.installments_total}` : 'Movimiento'} · {installment.month}</span>
											<span className="font-semibold">{money(installment.amount_cents)}</span>
										</div>
										<p className="text-sm text-zinc-600 dark:text-zinc-300">A cargo de {installment.responsibilities.map((responsibility) => `${responsibility.person} (${money(responsibility.amount_cents)})`).join(' · ')}</p>
									</li>
								))}
							</ul>
						</div>
					</>
				) : null}

				{canDecide ? (
					<div className="flex flex-col-reverse gap-3 border-t border-zinc-200 pt-5 dark:border-zinc-700 sm:flex-row sm:justify-end">
						<form action={rejectMcpTransactionProposalAction}>
							<input type="hidden" name="proposal_id" value={proposal.id} />
							<button className="min-h-11 rounded-lg border border-zinc-300 px-5 font-medium hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-700 dark:border-zinc-600 dark:hover:bg-zinc-700">{isUpdate ? 'Rechazar cambio' : 'Rechazar'}</button>
						</form>
						<form action={approveMcpTransactionProposal}>
							<input type="hidden" name="proposal_id" value={proposal.id} />
							<button className="min-h-11 rounded-lg bg-orange-600 px-5 font-semibold text-white hover:bg-orange-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-700">{isUpdate ? 'Aprobar edición' : 'Aprobar y guardar movimiento'}</button>
						</form>
					</div>
				) : proposal.state === 'pending' ? (
					<p className="border-t border-zinc-200 pt-4 text-sm text-zinc-600 dark:text-zinc-300">Esta propuesta venció. No se puede aprobar; generá una nueva desde la IA.</p>
				) : null}
			</article>
			<p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">La propuesta vence el {dateTime(proposal.expires_at)}. Al aprobar, Finanzar vuelve a verificar permisos, referencias y que el movimiento no haya cambiado.</p>
		</section>
	);
}
