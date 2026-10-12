'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { requireAuth } from '@/lib/auth';
import {
	McpChangeRequestError,
	decideMcpTransactionProposal,
	rejectMcpTransactionProposal,
} from '@/lib/mcp-change-requests';

function getProposalId(formData: FormData) {
	const proposalId = formData.get('proposal_id');
	if (typeof proposalId !== 'string' || !/^[0-9a-f-]{36}$/i.test(proposalId)) {
		throw new Error('Propuesta inválida.');
	}
	return proposalId;
}

function statusForError(error: unknown) {
	if (error instanceof McpChangeRequestError) {
		if (error.code === 'EXPIRED') return 'vencida';
		if (error.code === 'NOT_FOUND') return 'no-encontrada';
		if (error.code === 'FORBIDDEN_SCOPE') return 'permiso-revocado';
		if (error.code === 'CONFLICT') return 'cambio-detectado';
	}
	return 'error';
}

export async function approveMcpTransactionProposal(formData: FormData) {
	const session = await requireAuth();
	const proposalId = getProposalId(formData);
	let wasUpdate = false;
	try {
		const result = await decideMcpTransactionProposal(db, {
			ownerUserId: session.user.id,
			approvedByUserId: session.user.id,
			proposalId,
		});
		wasUpdate = 'updated' in result && result.updated === true;
	} catch (error) {
		revalidatePath(`/conexiones-ia/cambios/${proposalId}`);
		redirect(`/conexiones-ia/cambios/${proposalId}?resultado=${statusForError(error)}`);
	}
	revalidatePath('/');
	revalidatePath('/movimientos');
	revalidatePath('/conexiones-ia');
	revalidatePath(`/conexiones-ia/cambios/${proposalId}`);
	redirect(`/conexiones-ia/cambios/${proposalId}?resultado=${wasUpdate ? 'actualizada' : 'aplicada'}`);
}

export async function rejectMcpTransactionProposalAction(formData: FormData) {
	const session = await requireAuth();
	const proposalId = getProposalId(formData);
	try {
		await rejectMcpTransactionProposal(db, {
			ownerUserId: session.user.id,
			rejectedByUserId: session.user.id,
			proposalId,
		});
	} catch (error) {
		revalidatePath(`/conexiones-ia/cambios/${proposalId}`);
		redirect(`/conexiones-ia/cambios/${proposalId}?resultado=${statusForError(error)}`);
	}
	revalidatePath('/conexiones-ia');
	revalidatePath(`/conexiones-ia/cambios/${proposalId}`);
	redirect(`/conexiones-ia/cambios/${proposalId}?resultado=rechazada`);
}
