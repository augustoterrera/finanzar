import { parseSetCookieHeader, toCookieOptions } from 'better-auth/cookies';
import type { NextResponse } from 'next/server';

export function copyAuthCookies(headers: Headers, response: NextResponse) {
	for (const cookie of headers.getSetCookie()) {
		for (const [name, value] of parseSetCookieHeader(cookie)) {
			response.cookies.set(name, value.value, toCookieOptions(value));
		}
	}
	return response;
}
