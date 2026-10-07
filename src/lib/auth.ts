import { cookies } from 'next/headers';

export const SESSION_COOKIE_NAME = 'finanzar_session';

async function getSecretKey() {
	const password = process.env.APP_PASSWORD;
	if (!password) {
		throw new Error('APP_PASSWORD is not set');
	}

	const encoder = new TextEncoder();
	return await crypto.subtle.importKey(
		'raw',
		encoder.encode(password),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign', 'verify']
	);
}

function base64UrlEncode(buffer: ArrayBuffer | Uint8Array | string) {
    let str = '';
    if (typeof buffer === 'string') {
        str = btoa(buffer);
    } else {
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) {
            str += String.fromCharCode(bytes[i]);
        }
        str = btoa(str);
    }
    return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64UrlDecode(str: string) {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) {
        str += '=';
    }
    return atob(str);
}

export async function createSession() {
	const exp = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days
	const payloadStr = JSON.stringify({ exp, iat: Date.now(), id: crypto.randomUUID() });
	const payload = base64UrlEncode(payloadStr);
    
	const key = await getSecretKey();
	const encoder = new TextEncoder();
	const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
	const signature = base64UrlEncode(signatureBuffer);
    
	return `${payload}.${signature}`;
}

export async function isValidSession(value: string | undefined) {
	if (!value) return false;
	try {
		const parts = value.split('.');
		if (parts.length !== 2) return false;
		const [payload, signature] = parts;

		const key = await getSecretKey();
		const encoder = new TextEncoder();
		
        const sigStr = base64UrlDecode(signature);
        const signatureBuffer = new Uint8Array(sigStr.length);
        for (let i = 0; i < sigStr.length; i++) {
            signatureBuffer[i] = sigStr.charCodeAt(i);
        }
		
		const isValid = await crypto.subtle.verify('HMAC', key, signatureBuffer, encoder.encode(payload));
		if (!isValid) return false;

		const dataStr = base64UrlDecode(payload);
		const data = JSON.parse(dataStr);
		if (data.exp < Date.now()) return false;

		return true;
	} catch (e) {
		return false;
	}
}

export async function requireAuth() {
    const cookieStore = await cookies();
    const session = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const isValid = await isValidSession(session);
    if (!isValid) {
        throw new Error("Unauthorized");
    }
}
