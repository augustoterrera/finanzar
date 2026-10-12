import { drizzle } from 'drizzle-orm/libsql';
import { createClient, Client } from '@libsql/client';
import * as appSchema from './schema';
import * as authSchema from './auth-schema';

const schema = { ...appSchema, ...authSchema };

const dbUrl = process.env.TURSO_DATABASE_URL;
const dbToken = process.env.TURSO_AUTH_TOKEN;

if (!dbUrl) throw new Error('TURSO_DATABASE_URL is not set');

const isLocalDevelopmentDatabase = (() => {
	if (process.env.NODE_ENV === 'production' || dbToken) return false;
	try {
		const url = new URL(dbUrl);
		return url.protocol === 'http:' && ['127.0.0.1', 'localhost', '::1'].includes(url.hostname);
	} catch {
		return false;
	}
})();

if (!dbToken && !isLocalDevelopmentDatabase) throw new Error('TURSO_AUTH_TOKEN is not set');

const globalForDb = globalThis as unknown as {
  client: Client | undefined;
};

export const client =
	globalForDb.client ?? createClient({ url: dbUrl, ...(dbToken ? { authToken: dbToken } : {}) });

if (process.env.NODE_ENV !== 'production') globalForDb.client = client;

export const db = drizzle(client, { schema });
export type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
