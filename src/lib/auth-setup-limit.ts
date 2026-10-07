import { sql } from 'drizzle-orm';
import type { db } from '@/db';
import { rateLimit } from '@/db/auth-schema';

export const SETUP_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
export const SETUP_MAX_ATTEMPTS = 5;

export async function consumeSetupAttempt(database: typeof db, now = Date.now()) {
	const cutoff = now - SETUP_ATTEMPT_WINDOW_MS;
	// One shared bucket for this single-account setup. No client-supplied IP
	// can bypass it; the conditional UPSERT is atomic across all instances.
	const consumed = await database.insert(rateLimit).values({
		id: crypto.randomUUID(), key: 'finanzar:initial-setup', count: 1, lastRequest: now,
	}).onConflictDoUpdate({
		target: rateLimit.key,
		set: {
			count: sql`CASE WHEN ${rateLimit.lastRequest} <= ${cutoff} THEN 1 ELSE ${rateLimit.count} + 1 END`,
			lastRequest: sql`CASE WHEN ${rateLimit.lastRequest} <= ${cutoff} THEN ${now} ELSE ${rateLimit.lastRequest} END`,
		},
		setWhere: sql`${rateLimit.lastRequest} <= ${cutoff} OR ${rateLimit.count} < ${SETUP_MAX_ATTEMPTS}`,
	}).returning({ id: rateLimit.id });
	return consumed.length === 1;
}
