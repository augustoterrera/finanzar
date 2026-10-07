import { defineConfig } from 'drizzle-kit';
import 'dotenv/config';

if (!process.env.TURSO_DATABASE_URL) throw new Error('TURSO_DATABASE_URL is not set');

export default defineConfig({
	schema: './src/db/**/*.ts',
	dialect: 'turso',
	dbCredentials: {
		authToken: process.env.TURSO_AUTH_TOKEN,
		url: process.env.TURSO_DATABASE_URL
	},
	verbose: true,
	strict: true
});
