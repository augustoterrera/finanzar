'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { createInitialAccountAction } from './actions';
import { USERNAME_PATTERN } from '@/lib/auth-policy';

export function SetupForm() {
	const [state, formAction, pending] = useActionState(createInitialAccountAction, null);

	return (
		<form action={formAction} className="space-y-4">
			<div className="space-y-1.5">
				<label htmlFor="setupToken" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Código de configuración</label>
				<input id="setupToken" name="setupToken" type="password" autoComplete="one-time-code" required className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-base text-zinc-900 outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100" />
			</div>
			<div className="space-y-1.5">
				<label htmlFor="username" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Elegí un usuario</label>
				<input id="username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} minLength={3} maxLength={32} pattern={USERNAME_PATTERN} required className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-base text-zinc-900 outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100" aria-describedby="username-hint" />
				<p id="username-hint" className="text-sm text-zinc-600 dark:text-zinc-400">3–32 caracteres: letras, números, punto, guion o guion bajo.</p>
			</div>
			<div className="space-y-1.5">
				<label htmlFor="password" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Creá una contraseña</label>
				<input id="password" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-base text-zinc-900 outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100" aria-describedby="password-hint" />
				<p id="password-hint" className="text-sm text-zinc-600 dark:text-zinc-400">Usá al menos 12 caracteres. Un gestor de contraseñas ayuda.</p>
			</div>
			<div className="space-y-1.5">
				<label htmlFor="confirmPassword" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Repetí la contraseña</label>
				<input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-base text-zinc-900 outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100" />
			</div>
			{state?.error && <p role="alert" aria-live="polite" className="text-sm font-medium text-red-700 dark:text-red-300">{state.error}</p>}
			<button type="submit" disabled={pending} className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60 dark:focus-visible:ring-offset-zinc-900">
				{pending ? 'Creando acceso…' : 'Crear acceso privado'}
			</button>
			<Link href="/login" className="block rounded-lg px-4 py-2 text-center text-sm font-medium text-zinc-600 underline underline-offset-4 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:text-zinc-300 dark:hover:text-white">Volver al inicio de sesión</Link>
		</form>
	);
}
