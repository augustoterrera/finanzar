'use server';

import { redirect } from 'next/navigation';
import { auth, getSetupToken, secretsMatch } from '@/lib/auth-provider';
import { isInitialSetupAvailable } from '@/lib/auth';
import { db } from '@/db';
import { isValidUsername } from '@/lib/auth-policy';
import { consumeSetupAttempt } from '@/lib/auth-setup-limit';
import { createInitialAccount } from '@/lib/auth-initial-account';

type SetupState = { error?: string } | null;

export async function createInitialAccountAction(_previousState: SetupState, formData: FormData): Promise<SetupState> {
	try {
		if (!(await consumeSetupAttempt(db))) {
			return { error: 'Hubo varios intentos de configuración. Esperá 15 minutos y probá de nuevo.' };
		}
	} catch {
		return { error: 'No se pudo comprobar el acceso. Volvé a intentar en unos minutos.' };
	}
	const setupToken = formData.get('setupToken');
	const username = formData.get('username');
	const password = formData.get('password');
	const confirmPassword = formData.get('confirmPassword');
	const expectedToken = getSetupToken();

	if (
		typeof setupToken !== 'string' ||
		setupToken.length > 256 ||
		!expectedToken ||
		!(await secretsMatch(setupToken, expectedToken))
	) {
		return { error: 'El código de configuración no es válido.' };
	}

	if (!(await isInitialSetupAvailable())) {
		return { error: 'El acceso inicial ya fue configurado. Volvé al inicio de sesión.' };
	}

	if (typeof username !== 'string' || !isValidUsername(username)) {
		return { error: 'El usuario debe tener entre 3 y 32 caracteres: letras, números, punto, guion o guion bajo.' };
	}

	if (typeof password !== 'string' || password.length < 12 || password.length > 128) {
		return { error: 'La contraseña debe tener entre 12 y 128 caracteres.' };
	}
	if (password !== confirmPassword) return { error: 'Las contraseñas no coinciden.' };

	try {
		await createInitialAccount(auth, db, { setupToken, username, password });
	} catch {
		return { error: 'No se pudo crear el acceso. Revisá los datos o volvé a intentar.' };
	}

	redirect('/login?configurado=1');
}
