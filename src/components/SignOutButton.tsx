'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { authClient } from '@/lib/auth-client';

export function SignOutButton({ compact = false }: { compact?: boolean }) {
	const router = useRouter();
	const [busy, setBusy] = useState(false);

	async function signOut() {
		setBusy(true);
		try {
			const result = await authClient.signOut();
			if (result.error) {
				setBusy(false);
				return;
			}
			router.replace('/login');
			router.refresh();
		} catch {
			setBusy(false);
		} finally {
			setBusy(false);
		}
	}

	return (
		<button
			type="button"
			onClick={signOut}
			disabled={busy}
			aria-label="Cerrar sesión"
			title="Cerrar sesión"
			className={compact
				? 'relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'
				: 'inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'}
		>
			<LogOut aria-hidden="true" className="h-4 w-4" />
			{!compact && 'Salir'}
		</button>
	);
}
