import { db } from '@/db';
import { createFinanzarAuth } from './auth-config';
import { getSetupToken } from './auth-policy';

export { getSetupToken, secretsMatch } from './auth-policy';

const isProduction = process.env.NODE_ENV === 'production';
const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build';
const baseURL = process.env.BETTER_AUTH_URL ?? (isProduction && !isBuildPhase ? undefined : 'http://localhost:3000');
const authSecret = process.env.BETTER_AUTH_SECRET ?? (isBuildPhase ? 'build-only-secret-do-not-use-at-runtime' : undefined);

if (!baseURL) throw new Error('BETTER_AUTH_URL must be configured in production');
if (!authSecret) throw new Error('BETTER_AUTH_SECRET must be configured before the app starts');

export const auth = createFinanzarAuth(db, {
	baseURL,
	secret: authSecret,
	secureCookies: isProduction,
	getSetupToken,
});
