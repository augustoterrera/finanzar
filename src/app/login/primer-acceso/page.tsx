import Link from 'next/link';
import { SetupForm } from '../SetupForm';
import { isInitialSetupAvailable } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function InitialAccessPage() {
	const setupAvailable = await isInitialSetupAvailable().catch(() => false);

	return (
		<section className="mx-auto flex min-h-[65dvh] max-w-md items-center justify-center py-8">
			<div className="w-full rounded-2xl border border-zinc-200 bg-white p-7 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 sm:p-8">
				<h1 className="mb-2 text-center text-2xl font-bold text-zinc-900 dark:text-zinc-100">Crear tu acceso privado</h1>
				{setupAvailable ? (
					<>
						<p className="mb-6 text-center text-sm text-zinc-600 dark:text-zinc-400">Este paso se habilita una sola vez. Elegí un usuario y una contraseña que no uses en otros sitios. Como el acceso no usa correo, guardá la contraseña en un gestor: recuperarla requiere acceso administrativo.</p>
						<SetupForm />
					</>
					) : (
					<div className="space-y-4 text-center">
						<p className="text-sm text-zinc-600 dark:text-zinc-400">El acceso inicial ya fue configurado o todavía no está habilitado.</p>
						<Link href="/login" className="inline-flex rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900">Ir a iniciar sesión</Link>
					</div>
					)}
			</div>
		</section>
	);
}
