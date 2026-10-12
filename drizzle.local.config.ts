import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	schema: './src/db/**/*.ts',
	dialect: 'turso',
	dbCredentials: {
		url: 'http://127.0.0.1:8080',
	},
	verbose: true,
	strict: true,
});
