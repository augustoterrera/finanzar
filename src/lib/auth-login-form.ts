import { NextResponse } from 'next/server';
import type { createFinanzarAuth } from './auth-config';
import { copyAuthCookies } from './auth-cookies';
import { isValidUsername } from './auth-policy';
import type { LoginError } from './login-messages';

export async function submitLoginForm(auth: ReturnType<typeof createFinanzarAuth>, request: Request) {
	const baseURL = new URL(auth.options.baseURL as string);
	const redirect = (error?: LoginError) => {
		const response = NextResponse.redirect(new URL(error ? `/login?error=${error}` : '/', baseURL), 303);
		response.headers.set('Cache-Control', 'no-store');
		response.headers.set('Referrer-Policy', 'no-referrer');
		return response;
	};
	// Native forms need first-login CSRF protection even without a session cookie.
	if (request.headers.get('origin') !== baseURL.origin) {
		return new NextResponse('No autorizado', { status: 403, headers: { 'Cache-Control': 'no-store' } });
	}
	try {
		const formData = await request.formData();
		const username = formData.get('username');
		const password = formData.get('password');
		if (typeof username !== 'string' || !isValidUsername(username.trim()) || typeof password !== 'string' || password.length > 128) {
			return redirect('credenciales');
		}
		const headers = new Headers(request.headers);
		headers.set('content-type', 'application/json');
		headers.delete('content-length');
		// Go through the HTTP handler (not auth.api) to share the username
		// rate-limit bucket with the JavaScript login, including trusted IP headers.
		const result = await auth.handler(new Request(new URL('/api/auth/sign-in/username', baseURL), {
			method: 'POST', headers, body: JSON.stringify({ username: username.trim(), password }),
		}));
		if (!result.ok) return redirect(result.status === 429 ? 'limite' : result.status >= 500 ? 'conexion' : 'credenciales');
		return copyAuthCookies(result.headers, redirect());
	} catch {
		return redirect('conexion');
	}
}
