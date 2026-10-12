'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import { USERNAME_PATTERN } from '@/lib/auth-policy';
import { LOGIN_ERRORS, type LoginError } from '@/lib/login-messages';

export function LoginForm({ initialError, oauthQuery = '' }: { initialError?: LoginError; oauthQuery?: string }) {
	const router = useRouter();
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState(initialError ? LOGIN_ERRORS[initialError] : '');

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setBusy(true);
		setError('');
		const formData = new FormData(event.currentTarget);

		try {
			const result = await authClient.signIn.username({
				username: String(formData.get('username') ?? '').trim(),
				password: String(formData.get('password') ?? ''),
				callbackURL: oauthQuery ? `/conexiones-ia/consentimiento?${oauthQuery}` : '/',
			});
			if (result.error) {
				setError(result.error.status === 429 ? LOGIN_ERRORS.limite
					: result.error.status >= 500 ? LOGIN_ERRORS.conexion : LOGIN_ERRORS.credenciales);
				return;
			}
			router.replace(oauthQuery ? `/conexiones-ia/consentimiento?${oauthQuery}` : '/');
			router.refresh();
		} catch {
			setError('No se pudo conectar. Revisá tu conexión e intentá de nuevo.');
		} finally {
			setBusy(false);
		}
	}

	return (
		<form method="post" action="/api/auth/login" onSubmit={submit} className="space-y-4">
			{oauthQuery && <input type="hidden" name="oauth_query" value={oauthQuery} />}
			<div className="space-y-1.5">
				<label htmlFor="username" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Usuario</label>
				<input
					autoComplete="username"
					autoCapitalize="none"
					spellCheck={false}
					required
					minLength={3}
					maxLength={32}
					pattern={USERNAME_PATTERN}
					id="username"
					name="username"
					className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-base text-zinc-900 outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
				/>
			</div>
			<div className="space-y-1.5">
				<label htmlFor="password" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Contraseña</label>
				<input
					autoComplete="current-password"
					required
					id="password"
					name="password"
					maxLength={128}
					type="password"
					className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-base text-zinc-900 outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
				/>
			</div>
			{error && <p role="alert" aria-live="polite" className="text-sm font-medium text-red-700 dark:text-red-300">{error}</p>}
			<button
				type="submit"
				disabled={busy}
				className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60 dark:focus-visible:ring-offset-zinc-900"
			>
				{busy ? 'Ingresando…' : 'Iniciar sesión'}
			</button>
		</form>
	);
}
