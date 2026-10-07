import { eq } from 'drizzle-orm';
import { APIError } from 'better-auth/api';
import type { db } from '@/db';
import { user } from '@/db/auth-schema';
import type { createFinanzarAuth } from './auth-config';
import { INITIAL_ACCOUNT_EMAIL } from './auth-policy';

export async function createInitialAccount(
	auth: ReturnType<typeof createFinanzarAuth>,
	database: typeof db,
	credentials: { username: string; password: string; setupToken: string },
) {
	const result = await auth.api.signUpEmail({
		headers: new Headers({ 'x-finanzar-setup-token': credentials.setupToken }),
		body: {
			email: INITIAL_ACCOUNT_EMAIL, name: credentials.username,
			username: credentials.username, password: credentials.password,
		},
	});
	// With autoSignIn:false Better Auth deliberately returns a synthetic success
	// for duplicate/denied signup. Never report that as a newly created account.
	const [created] = await database.select({ id: user.id }).from(user).where(eq(user.id, result.user.id)).limit(1);
	if (!created) throw new APIError('CONFLICT', { message: 'El acceso inicial ya fue configurado o el alta fue rechazada.' });
	return created;
}
