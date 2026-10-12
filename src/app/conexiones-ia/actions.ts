'use server';

import { and, eq, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/auth';
import { db } from '@/db';
import { oauthConsent, oauthRefreshToken } from '@/db/auth-schema';
import { mcp_access_grants } from '@/db/schema';

export async function revokeAiConnection(formData: FormData) {
	const session = await requireAuth();
	const clientId = formData.get('client_id');
	if (typeof clientId !== 'string' || clientId.length < 1 || clientId.length > 2048) throw new Error('Conexión inválida.');
	const revokedAt = new Date();
	await db.transaction(async (tx) => {
		await tx.delete(oauthConsent).where(and(eq(oauthConsent.userId, session.user.id), eq(oauthConsent.clientId, clientId)));
		await tx.update(mcp_access_grants).set({ revoked_at: revokedAt }).where(and(
			eq(mcp_access_grants.owner_user_id, session.user.id), eq(mcp_access_grants.client_id, clientId), isNull(mcp_access_grants.revoked_at),
		));
		await tx.update(oauthRefreshToken).set({ revoked: revokedAt }).where(and(
			eq(oauthRefreshToken.userId, session.user.id), eq(oauthRefreshToken.clientId, clientId), isNull(oauthRefreshToken.revoked),
		));
	});
	revalidatePath('/conexiones-ia');
}
