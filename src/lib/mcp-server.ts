import { McpServer, type CallToolResult, type McpRequestContext } from '@modelcontextprotocol/server';
import { z } from 'zod';
import type { db } from '@/db';
import { getFinanceContext, getMonthlyExpenseLedgerSnapshot } from '@/lib/expense-ledger-service';
import { getMcpInstallmentGroup, getMcpTransaction, listMcpRecurringRules } from '@/lib/mcp-read-service';
import { auditMcpFinancialData, getMcpCardStatement, getMcpSpendingSummary, searchMcpTransactions } from '@/lib/mcp-query-service';
import { cancelMcpTransactionProposal, createMcpInstallmentGroupUpdateProposal, createMcpTransactionProposal, createMcpTransactionUpdateProposal, decideMcpTransactionProposal, getMcpChangeRequest, McpChangeRequestError, MCP_TRANSACTION_WRITE_SCOPE, toTransactionDraft } from '@/lib/mcp-change-requests';
import { formatCents } from '@/lib/format';

function getOwnerUserId(context: McpRequestContext): string {
	const subject = context.authInfo?.extra?.ownerUserId;
	if (typeof subject !== 'string' || subject.length === 0) throw new Error('Token sin titular autenticado');
	return subject;
}

function jsonText(value: unknown): CallToolResult {
	return { content: [{ type: 'text' as const, text: JSON.stringify(value) }] };
}

function toolError(code: string, message: string): CallToolResult {
	return { isError: true, content: [{ type: 'text', text: JSON.stringify({ error: { code, message } }) }] };
}

function safeTool<TArgs extends unknown[]>(handler: (...args: TArgs) => Promise<CallToolResult>) {
	return async (...args: TArgs): Promise<CallToolResult> => {
		try {
			return await handler(...args);
		} catch (error) {
			if (error instanceof McpChangeRequestError) return toolError(error.code, error.message);
			if (error instanceof RangeError) return toolError('VALIDATION_ERROR', error.message);
			return toolError('INTERNAL_ERROR', 'No se pudo completar la consulta. Intentá de nuevo más tarde.');
		}
	};
}

function getConnectionContext(context: McpRequestContext) {
	const authInfo = context.authInfo;
	const extra = authInfo?.extra;
	const ownerUserId = extra && typeof extra.ownerUserId === 'string' ? extra.ownerUserId : '';
	const jti = extra && typeof extra.jti === 'string' ? extra.jti : '';
	if (!ownerUserId || !jti || !authInfo?.clientId) throw new Error('Falta el contexto autenticado del cliente MCP.');
	return { ownerUserId, jti, clientId: authInfo.clientId, scopes: authInfo.scopes };
}

export function createFinanzarMcpServer(database: typeof db) {
	return (context: McpRequestContext) => {
		const server = new McpServer({ name: 'finanzar', version: '1.0.0' });
		const ownerUserId = getOwnerUserId(context);

		server.registerTool('finanzar_get_context', {
			title: 'Consultar el contexto de Finanzar',
			description: 'Devuelve personas responsables, tarjetas y medios de pago disponibles con sus IDs. Las personas son responsables de los gastos, no cuentas de acceso.',
			inputSchema: z.object({}),
			annotations: { readOnlyHint: true, openWorldHint: false },
		}, safeTool(async () => jsonText(await getFinanceContext(database, ownerUserId))));

		server.registerTool('finanzar_get_month_summary', {
			title: 'Consultar resumen mensual',
			description: 'Devuelve totales del mes por responsable y tarjeta. Las responsabilidades se calculan con las divisiones del gasto, no con quién pagó. Importes expresados en centavos de ARS.',
			inputSchema: z.object({
				month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).describe('Mes de impacto AAAA-MM, por ejemplo 2026-10'),
			}),
			annotations: { readOnlyHint: true, openWorldHint: false },
		}, safeTool(async ({ month }) => {
			const snapshot = await getMonthlyExpenseLedgerSnapshot(database, ownerUserId, month);
			return jsonText({
				month: snapshot.month,
				currency: 'ARS',
				unit: 'centavos',
				income_cents: snapshot.income,
				owner_expenses_cents: snapshot.ownerExpenses,
				totals_by_person_and_card: snapshot.ledgers.map((ledger) => ({
					person: ledger.personName,
					card: ledger.cardName,
					transactions_count: ledger.items.length,
					total_cents: ledger.total,
					total_ars: formatCents(ledger.total),
				})),
				integrity_warnings: snapshot.ledgers.some((ledger) => ledger.personId === null)
					? ['Hay gastos con una parte sin responsable asignado.'] : [],
			});
		}));

		server.registerTool('finanzar_get_spending_summary', {
			title: 'Analizar gastos por período',
			description: 'Resume movimientos del período agrupados por responsable, tarjeta, medio de pago, pagador o mes. Si se agrupa por responsable, usa solo la parte asignada; si se agrupa por pagador, usa el total del movimiento. Por defecto suma egresos activos de todo el historial.',
			inputSchema: z.object({
				from_month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(),
				to_month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(),
				type: z.enum(['expense', 'income', 'all']).default('expense'),
				status: z.enum(['active', 'void', 'all']).default('active'),
				person_id: z.string().min(1).optional().describe('Filtra por responsable económico; la suma respeta solo su parte.'),
				payer_person_id: z.string().min(1).optional().describe('Filtra quién pagó; no equivale al responsable.'),
				card_id: z.string().min(1).optional(),
				payment_method_id: z.string().min(1).optional(),
				group_by: z.array(z.enum(['person', 'card', 'payment_method', 'payer', 'month'])).max(2).default(['person', 'card']),
			}),
			annotations: { readOnlyHint: true, openWorldHint: false },
		}, safeTool(async (input) => jsonText(await getMcpSpendingSummary(database, ownerUserId, input))));

		server.registerTool('finanzar_get_card_statement', {
			title: 'Consultar movimientos de una tarjeta en un mes',
			description: 'Suma movimientos de una tarjeta por mes de impacto y desglosa la parte por responsable. No representa un saldo bancario confirmado ni permite inferir pagos, impuestos o mora que no estén cargados.',
			inputSchema: z.object({
				card_id: z.string().min(1),
				month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
			}),
			annotations: { readOnlyHint: true, openWorldHint: false },
		}, safeTool(async ({ card_id, month }) => {
			const result = await getMcpCardStatement(database, ownerUserId, card_id, month);
			return result ? jsonText(result) : toolError('NOT_FOUND', 'No se encontró la tarjeta solicitada.');
		}));

		server.registerTool('finanzar_search_transactions', {
			title: 'Buscar movimientos con filtros',
			description: 'Busca en el historial por mes/rango de impacto, fechas guardadas, responsable, pagador, tarjeta, medio de pago, tipo, estado, importe o descripción. Las fechas guardadas de cuotas pueden no ser la fecha original de consumo; el importe de una fila de cuotas no es el total de compra. Usa el cursor devuelto para continuar.',
			inputSchema: z.object({
				month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(),
				from_month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(),
				to_month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(),
				date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
				date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
				person_id: z.string().min(1).optional(),
				payer_person_id: z.string().min(1).optional(),
				card_id: z.string().min(1).optional(),
				payment_method_id: z.string().min(1).optional(),
				type: z.enum(['expense', 'income']).optional(),
				status: z.enum(['active', 'void']).default('active'),
				min_amount_cents: z.number().int().min(0).optional(),
				max_amount_cents: z.number().int().min(0).optional(),
				description_contains: z.string().min(2).max(100).optional(),
				limit: z.number().int().min(1).max(100).default(50),
				cursor: z.string().max(512).optional(),
			}),
			annotations: { readOnlyHint: true, openWorldHint: false },
		}, safeTool(async (input) => jsonText(await searchMcpTransactions(database, ownerUserId, input))));

		server.registerTool('finanzar_audit_data_integrity', {
			title: 'Revisar consistencia de movimientos',
			description: 'Busca egresos sin responsables, divisiones que no suman el movimiento, tarjeta incompatible con el medio de pago, importes inválidos y series completas cuyo total no coincide. Una serie parcial no se marca como error automáticamente.',
			inputSchema: z.object({
				from_month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(),
				to_month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(),
				limit: z.number().int().min(1).max(100).default(50),
			}),
			annotations: { readOnlyHint: true, openWorldHint: false },
		}, safeTool(async ({ from_month, to_month, limit }) => jsonText(await auditMcpFinancialData(database, ownerUserId, { from_month, to_month, limit }))));

		server.registerTool('finanzar_list_transactions', {
			title: 'Listar movimientos del mes',
			description: 'Lista movimientos de un mes de impacto, opcionalmente filtrados por responsable y tarjeta. El filtro de responsable usa la parte asignada del gasto; los importes están en centavos de ARS.',
			inputSchema: z.object({
				month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).describe('Mes de impacto AAAA-MM'),
				person_id: z.string().min(1).optional().describe('ID de la persona responsable, obtenido del contexto de Finanzar'),
				card_id: z.string().min(1).optional().describe('ID de tarjeta, obtenido del contexto de Finanzar'),
				limit: z.number().int().min(1).max(100).default(50),
			}),
			annotations: { readOnlyHint: true, openWorldHint: false },
		}, safeTool(async ({ month, person_id, card_id, limit }) => {
			const snapshot = await getMonthlyExpenseLedgerSnapshot(database, ownerUserId, month);
			const personById = new Map(snapshot.people.map((person) => [person.id, person.name]));
			const splitsByTransaction = new Map<string, Array<{ person_id: string; amount: number }>>();
			for (const split of snapshot.splits) {
				const rows = splitsByTransaction.get(split.transaction_id) ?? [];
				rows.push({ person_id: split.person_id, amount: split.amount });
				splitsByTransaction.set(split.transaction_id, rows);
			}
			const matched = snapshot.transactions
				.filter((transaction) => transaction.type === 'expense')
				.filter((transaction) => !card_id || transaction.card_id === card_id)
				.filter((transaction) => !person_id || (splitsByTransaction.get(transaction.id) ?? []).some((split) => split.person_id === person_id))
				.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
			const records = matched.slice(0, limit).map((transaction) => ({
				id: transaction.id,
				date: transaction.date,
				impact_month: transaction.month,
				description: transaction.description,
				amount_cents: transaction.amount,
				card_id: transaction.card_id,
				responsibilities: (splitsByTransaction.get(transaction.id) ?? [])
					.filter((split) => !person_id || split.person_id === person_id)
					.map((split) => ({ person_id: split.person_id, person: personById.get(split.person_id) ?? 'Persona no encontrada', amount_cents: split.amount })),
			}));
			return jsonText({
				month, currency: 'ARS', unit: 'centavos', filters: { person_id: person_id ?? null, card_id: card_id ?? null },
				total_matching_records: matched.length, returned_records: records.length, truncated: matched.length > records.length, records,
			});
		}));

		server.registerTool('finanzar_get_transaction', {
			title: 'Consultar un movimiento',
			description: 'Devuelve un movimiento con pagador, responsables, medio de pago, tarjeta y referencia de cuotas. Importes en centavos de ARS.',
			inputSchema: z.object({ transaction_id: z.string().min(1).max(128) }),
			annotations: { readOnlyHint: true, openWorldHint: false },
		}, safeTool(async ({ transaction_id }) => {
			const result = await getMcpTransaction(database, ownerUserId, transaction_id);
			return result ? jsonText(result) : toolError('NOT_FOUND', 'No se encontró el movimiento solicitado.');
		}));

		server.registerTool('finanzar_get_installment_group', {
			title: 'Consultar una compra en cuotas',
			description: 'Muestra el total original de la compra y las cuotas registradas con sus meses y partes por responsable. No confunde el total con las cuotas restantes.',
			inputSchema: z.object({ installment_group_id: z.string().min(1).max(128) }),
			annotations: { readOnlyHint: true, openWorldHint: false },
		}, safeTool(async ({ installment_group_id }) => {
			const result = await getMcpInstallmentGroup(database, ownerUserId, installment_group_id);
			return result ? jsonText(result) : toolError('NOT_FOUND', 'No se encontró el grupo de cuotas solicitado.');
		}));

		server.registerTool('finanzar_list_recurring_rules', {
			title: 'Consultar gastos recurrentes',
			description: 'Lista reglas recurrentes; una regla no significa que una ocurrencia ya esté generada o pagada.',
			inputSchema: z.object({ active_only: z.boolean().default(false), limit: z.number().int().min(1).max(100).default(50) }),
			annotations: { readOnlyHint: true, openWorldHint: false },
		}, safeTool(async ({ active_only, limit }) => {
			return jsonText(await listMcpRecurringRules(database, ownerUserId, { activeOnly: active_only, limit }));
		}));

		server.registerTool('finanzar_propose_create_transaction', {
			title: 'Proponer un movimiento para aprobación',
			description: 'Prepara un movimiento nuevo y devuelve una vista previa completa. No escribe nada todavía. Muestra esa vista previa en el chat y pide una confirmación clara antes de llamar finanzar_apply_confirmed_change. Si el usuario no confirma, no apliques. amount_cents es el total de compra, no el valor de una cuota.',
			inputSchema: z.object({
				idempotency_key: z.string().min(8).max(128).regex(/^[A-Za-z0-9._:-]+$/),
				type: z.enum(['expense', 'income']),
				date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
				amount_cents: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
				description: z.string().trim().min(1).max(500),
				payer_person_id: z.string().min(1).max(128),
				payment_method_id: z.string().min(1).max(128),
				responsibilities: z.array(z.object({
					person_id: z.string().min(1).max(128),
					amount_cents: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
				}).strict()).min(1).max(20),
				installments_total: z.number().int().min(1).max(120).default(1),
				starting_installment: z.number().int().min(1).max(120).default(1),
				impact_month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(),
			}).strict(),
			annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
		}, safeTool(async (input) => {
			const connection = getConnectionContext(context);
			const proposal = await createMcpTransactionProposal(database, {
				...connection,
				idempotencyKey: input.idempotency_key,
				draft: toTransactionDraft(input),
			});
			return jsonText({
				proposal_id: proposal.id,
				state: proposal.state,
				expires_at: proposal.expires_at,
				reused: proposal.reused,
				preview: proposal.preview,
				requires_explicit_user_confirmation: proposal.state === 'pending',
				message: 'Propuesta guardada; no se escribió nada. Muestra al usuario el resumen completo, pide confirmación explícita en este chat y solo entonces llama finanzar_apply_confirmed_change con esta propuesta.',
			});
		}));

		server.registerTool('finanzar_propose_update_transaction', {
			title: 'Proponer la edición de un movimiento',
			description: 'Propone editar un movimiento individual activo. Primero consulta finanzar_get_transaction y envía el estado final completo, conservando lo que no cambia. Solo se edita si no es una cuota ni un movimiento recurrente. Devuelve el antes/después; no escribe nada. Muestra el diff en el chat y pide confirmación clara; solo después llama finanzar_apply_confirmed_change. amount_cents y las responsabilidades son centavos enteros que deben sumar exactamente. Si impact_month se omite, se conserva el mes actual.',
			inputSchema: z.object({
				idempotency_key: z.string().min(8).max(128).regex(/^[A-Za-z0-9._:-]+$/),
				transaction_id: z.string().min(1).max(128),
				date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
				amount_cents: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
				description: z.string().trim().min(1).max(500),
				payer_person_id: z.string().min(1).max(128),
				payment_method_id: z.string().min(1).max(128),
				responsibilities: z.array(z.object({
					person_id: z.string().min(1).max(128),
					amount_cents: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
				}).strict()).min(1).max(20),
				impact_month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(),
			}).strict(),
			annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
		}, safeTool(async (input) => {
			const connection = getConnectionContext(context);
			const proposal = await createMcpTransactionUpdateProposal(database, {
				...connection,
				update: {
					idempotency_key: input.idempotency_key,
					transaction_id: input.transaction_id,
					date: input.date,
					amount_cents: input.amount_cents,
					description: input.description,
					payer_person_id: input.payer_person_id,
					payment_method_id: input.payment_method_id,
					responsibilities: input.responsibilities,
					impact_month: input.impact_month,
				},
			});
			return jsonText({
				proposal_id: proposal.id,
				state: proposal.state,
				expires_at: proposal.expires_at,
				reused: proposal.reused,
				preview: proposal.preview,
				requires_explicit_user_confirmation: proposal.state === 'pending',
				message: 'Edición propuesta; el movimiento original sigue intacto. Muestra al usuario todos los campos actuales y propuestos, pide confirmación explícita en este chat y solo entonces llama finanzar_apply_confirmed_change con esta propuesta.',
			});
		}));

		server.registerTool('finanzar_propose_update_installment_group', {
			title: 'Proponer la corrección de una compra en cuotas',
			description: 'Propone corregir la compra y TODAS sus cuotas registradas como una única operación (scope entire_recorded_group). purchase_total_cents es el nuevo TOTAL de la compra, no el importe de una cuota. Envía el reparto del total completo; los centavos y las cuotas futuras se recalculan. La vista previa debe mostrar el total anterior/nuevo, cada cuota anterior/nueva, responsables, medio/tarjeta y meses afectados. No escribe nada hasta confirmación explícita y finanzar_apply_confirmed_change.',
			inputSchema: z.object({
				idempotency_key: z.string().min(8).max(128).regex(/^[A-Za-z0-9._:-]+$/),
				installment_group_id: z.string().min(1).max(128),
				scope: z.literal('entire_recorded_group'),
				purchase_total_cents: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
				description: z.string().trim().min(1).max(500),
				payer_person_id: z.string().min(1).max(128),
				payment_method_id: z.string().min(1).max(128),
				responsibilities: z.array(z.object({
					person_id: z.string().min(1).max(128),
					amount_cents: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
				}).strict()).min(1).max(20),
			}).strict(),
			annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
		}, safeTool(async (input) => {
			const connection = getConnectionContext(context);
			const proposal = await createMcpInstallmentGroupUpdateProposal(database, {
				...connection,
				update: {
					idempotency_key: input.idempotency_key,
					installment_group_id: input.installment_group_id,
					scope: input.scope,
					purchase_total_cents: input.purchase_total_cents,
					description: input.description,
					payer_person_id: input.payer_person_id,
					payment_method_id: input.payment_method_id,
					responsibilities: input.responsibilities,
				},
			});
			return jsonText({
				proposal_id: proposal.id,
				state: proposal.state,
				expires_at: proposal.expires_at,
				reused: proposal.reused,
				preview: proposal.preview,
				requires_explicit_user_confirmation: proposal.state === 'pending',
				message: 'Corrección de toda la serie propuesta; la compra y sus cuotas siguen intactas. Muestra el diff completo, pide confirmación explícita en el chat y solo entonces llama finanzar_apply_confirmed_change.',
			});
		}));

		server.registerTool('finanzar_apply_confirmed_change', {
			title: 'Aplicar el cambio confirmado en el chat',
			description: 'Aplica exactamente una propuesta pendiente y sin modificaciones externas. Solo llama esta herramienta después de mostrar al usuario el resumen/diff completo y recibir un sí explícito en esta conversación para esta propuesta concreta. No infieras confirmación de una solicitud inicial, silencio o respuestas ambiguas. Si el usuario rechaza, no llames esta herramienta. El servidor revalida titular, cliente OAuth, permiso de escritura, vencimiento, referencias y versión; no acepta aquí cambios adicionales.',
			inputSchema: z.object({
				proposal_id: z.string().uuid(),
				user_confirmed: z.literal(true).describe('Debe ser true solo después de que el usuario haya confirmado explícitamente esta propuesta en el chat.'),
			}).strict(),
			annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
		}, safeTool(async ({ proposal_id }) => {
			const connection = getConnectionContext(context);
			if (!connection.scopes.includes(MCP_TRANSACTION_WRITE_SCOPE)) {
				throw new McpChangeRequestError('FORBIDDEN_SCOPE', 'Esta conexión no tiene permiso de escritura.');
			}
			const proposal = await getMcpChangeRequest(database, connection.ownerUserId, proposal_id, connection.clientId);
			if (!proposal) throw new McpChangeRequestError('NOT_FOUND', 'No se encontró una propuesta de esta conexión.');
			const result = await decideMcpTransactionProposal(database, {
				ownerUserId: connection.ownerUserId,
				approvedByUserId: connection.ownerUserId,
				proposalId: proposal_id,
				clientId: connection.clientId,
				jti: connection.jti,
				scopes: connection.scopes,
				approvalChannel: 'mcp_chat',
			});
			return jsonText({
				proposal_id,
				state: 'applied',
				result,
				message: proposal.operation === 'update_transaction'
					? 'Cambio confirmado en el chat y aplicado. El movimiento fue actualizado.'
					: proposal.operation === 'update_installment_group'
						? 'Cambio confirmado en el chat y aplicado. La compra en cuotas y sus cuotas registradas fueron actualizadas.'
						: 'Cambio confirmado en el chat y aplicado. El movimiento fue creado.',
			});
		}));

		server.registerTool('finanzar_get_change_request', {
			title: 'Consultar una propuesta propia',
			description: 'Consulta el estado y la vista previa o resultado de una propuesta creada por esta conexión. No revela propuestas de otras conexiones.',
			inputSchema: z.object({ proposal_id: z.string().uuid() }).strict(),
			annotations: { readOnlyHint: true, openWorldHint: false },
		}, safeTool(async ({ proposal_id }) => {
			const connection = getConnectionContext(context);
			const proposal = await getMcpChangeRequest(database, connection.ownerUserId, proposal_id, connection.clientId);
			return proposal ? jsonText(proposal) : toolError('NOT_FOUND', 'No se encontró la propuesta solicitada.');
		}));

		server.registerTool('finanzar_cancel_change_request', {
			title: 'Cancelar una propuesta pendiente',
			description: 'Cancela una propuesta propia que todavía esté pendiente. No revierte movimientos ya aprobados; esa operación requiere otra propuesta y aprobación.',
			inputSchema: z.object({ proposal_id: z.string().uuid() }).strict(),
			annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
		}, safeTool(async ({ proposal_id }) => {
			const connection = getConnectionContext(context);
			return jsonText(await cancelMcpTransactionProposal(database, { ...connection, proposalId: proposal_id }));
		}));
		return server;
	};
}
