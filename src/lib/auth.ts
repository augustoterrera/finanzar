import { headers } from 'next/headers';
import { db } from '@/db';
import { user } from '@/db/auth-schema';
import { ledger_accounts } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { auth, getSetupToken } from '@/lib/auth-provider';

export async function getCurrentSession() {
	// Authorization is read-only here: Proxy/HTTP auth handlers renew sessions
	// where the resulting Set-Cookie can actually reach the browser.
	return auth.api.getSession({ headers: await headers(), query: { disableRefresh: true } });
}

export async function hasValidSession() {
	try {
		return Boolean(await getCurrentSession());
	} catch {
		return false;
	}
}

export async function requireAuth() {
	const session = await getCurrentSession();
	if (!session) throw new Error('Unauthorized');
	const [ledgerOwner] = await db.select({ id: ledger_accounts.id })
		.from(ledger_accounts)
		.where(eq(ledger_accounts.owner_user_id, session.user.id))
		.limit(1);
	if (!ledgerOwner || ledgerOwner.id !== 'private') throw new Error('Forbidden');
	return session;
}

export async function isInitialSetupAvailable() {
	if (!getSetupToken()) return false;
	const [existingUser] = await db.select({ id: user.id }).from(user).limit(1);
	return !existingUser;
}
