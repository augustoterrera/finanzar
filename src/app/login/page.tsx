import Link from 'next/link';
import { LoginForm } from './LoginForm';
import { isInitialSetupAvailable } from '@/lib/auth';
import { LOGIN_ERRORS, type LoginError } from '@/lib/login-messages';

export const dynamic = 'force-dynamic';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ configurado?: string; error?: string }> }) {
	const [setupAvailable, params] = await Promise.all([
		isInitialSetupAvailable().catch(() => false),
		searchParams,
	]);
	const initialError = params.error && Object.hasOwn(LOGIN_ERRORS, params.error) ? params.error as LoginError : undefined;

	return (
		<section className="mx-auto flex min-h-[65dvh] max-w-md items-center justify-center py-8">
			<div className="w-full rounded-2xl border border-zinc-200 bg-white p-7 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 sm:p-8">
				<h1 className="mb-2 text-center text-2xl font-bold text-zinc-900 dark:text-zinc-100">Iniciar sesión</h1>
				<p className="mb-6 text-center text-sm text-zinc-600 dark:text-zinc-400">Ingresá a tus cuentas con tu usuario y contraseña.</p>
				{params.configurado === '1' && <p role="status" className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800 dark:bg-green-950/40 dark:text-green-200">Acceso creado. Ya podés iniciar sesión.</p>}
				<LoginForm initialError={initialError} />
				{setupAvailable && <Link href="/login/primer-acceso" className="mt-5 block text-center text-sm font-medium text-blue-700 underline underline-offset-4 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:text-blue-300">Configurar el primer acceso</Link>}
			</div>
		</section>
	);
}
