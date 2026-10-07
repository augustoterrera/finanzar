import { betterAuth } from 'better-auth';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { username } from 'better-auth/plugins';
import { APIError } from 'better-auth/api';
import type { db } from '@/db';
import { INITIAL_ACCOUNT_EMAIL, isValidUsername, secretsMatch } from './auth-policy';

type AuthConfiguration = {
	baseURL: string;
	secret: string;
	secureCookies: boolean;
	getSetupToken: () => string | undefined;
};

export function createFinanzarAuth(database: typeof db, configuration: AuthConfiguration) {
	return betterAuth({
		appName: 'Finanzar',
		baseURL: configuration.baseURL,
		secret: configuration.secret,
		database: drizzleAdapter(database, { provider: 'sqlite', transaction: true }),
		// Only the server-side initial-account action may invoke signUpEmail.
		disabledPaths: ['/sign-in/email', '/sign-up/email'],
		emailAndPassword: {
			enabled: true,
			disableSignUp: false,
			autoSignIn: false,
			minPasswordLength: 12,
			maxPasswordLength: 128,
		},
		plugins: [username({ minUsernameLength: 3, maxUsernameLength: 32, usernameValidator: isValidUsername })],
		session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 12 },
		rateLimit: {
			enabled: true,
			storage: 'database',
			window: 60,
			max: 60,
			customRules: { '/sign-in/username': { window: 15 * 60, max: 8 } },
		},
		databaseHooks: {
			user: {
				create: {
					before: async (newUser, context) => {
						const configuredToken = configuration.getSetupToken();
						const receivedToken = context?.headers?.get('x-finanzar-setup-token');
						if (!context || !configuredToken || !receivedToken || !(await secretsMatch(receivedToken, configuredToken))) {
							throw new APIError('FORBIDDEN', { message: 'El alta de usuarios está cerrada.' });
						}
						// Every initial account uses the same UNIQUE email: a DB-enforced
						// singleton across concurrent requests and server instances.
						if (newUser.email !== INITIAL_ACCOUNT_EMAIL) {
							throw new APIError('BAD_REQUEST', { message: 'El correo de configuración no es válido.' });
						}
						// Use the current transaction, not an unrelated global DB query.
						if (await context.context.internalAdapter.countTotalUsers()) {
							throw new APIError('CONFLICT', { message: 'El acceso inicial ya fue configurado.' });
						}
						return { data: newUser };
					},
				},
			},
		},
		advanced: {
			ipAddress: { ipAddressHeaders: ['x-vercel-forwarded-for'] },
			useSecureCookies: configuration.secureCookies,
			defaultCookieAttributes: { httpOnly: true, sameSite: 'lax', secure: configuration.secureCookies },
		},
	});
}
