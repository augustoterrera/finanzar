// Aplica scripts/prod-migracion-0003-0008.sql a la base de producción.
// Uso: node scripts/aplicar-migracion-prod.mjs
// Lee las credenciales de vercel-production.env sin imprimirlas.
import { readFileSync } from 'node:fs';
import { createClient } from '@libsql/client';

const env = Object.fromEntries(readFileSync('vercel-production.env', 'utf8').split('\n')
	.filter((line) => /^[A-Z_]+=/.test(line))
	.map((line) => {
		const i = line.indexOf('=');
		return [line.slice(0, i), line.slice(i + 1).trim().replace(/^"|"$/g, '')];
	}));

const client = createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN });
const value = async (sql) => (await client.execute(sql)).rows[0][0];
const snapshot = async () => ({
	migraciones: Number(await value('select count(*) from __drizzle_migrations')),
	usuarios: Number(await value('select count(*) from user')),
	movimientos: Number(await value('select count(*) from transactions')),
	repartos: Number(await value('select count(*) from transaction_splits')),
	sumaMovimientos: Number(await value('select coalesce(sum(amount), 0) from transactions')),
	sumaRepartos: Number(await value('select coalesce(sum(amount), 0) from transaction_splits')),
});

const before = await snapshot();
console.log('Antes:', before);

if (before.migraciones !== 3) {
	console.error(`Se esperaban 3 migraciones registradas y hay ${before.migraciones}. No se aplica nada.`);
	process.exit(1);
}
if (before.usuarios !== 1) {
	console.error(`Se esperaba exactamente 1 usuario y hay ${before.usuarios}. No se aplica nada.`);
	process.exit(1);
}

await client.executeMultiple(readFileSync('scripts/prod-migracion-0003-0008.sql', 'utf8'));

const after = await snapshot();
const ledger = (await client.execute('select count(*) as n from ledger_accounts')).rows[0].n;
console.log('Después:', after, { libroVinculado: Number(ledger) === 1 });

const unchanged = ['usuarios', 'movimientos', 'repartos', 'sumaMovimientos', 'sumaRepartos']
	.every((key) => before[key] === after[key]);
if (after.migraciones === 9 && unchanged && Number(ledger) === 1) {
	console.log('OK: migración aplicada y datos intactos.');
} else {
	console.error('ATENCIÓN: el resultado no es el esperado. Revisar antes de deployar.');
	process.exit(1);
}
