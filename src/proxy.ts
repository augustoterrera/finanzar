import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from './lib/auth-provider';
import { copyAuthCookies } from './lib/auth-cookies';
import { bypassesSessionProxy } from './lib/proxy-path-policy';

export async function proxy(request: NextRequest) {
  if (bypassesSessionProxy(request.nextUrl.pathname)) return NextResponse.next();

  const { response: session, headers: sessionHeaders } = await auth.api.getSession({
    headers: request.headers,
    returnHeaders: true,
  });
  const isAuthenticated = Boolean(session);
  const isLoginRoute = request.nextUrl.pathname.startsWith('/login');

  if (!isAuthenticated && !isLoginRoute) {
    const response = copyAuthCookies(sessionHeaders, NextResponse.redirect(new URL('/login', request.url)));
    if (request.nextUrl.pathname.startsWith('/conexiones-ia/cambios/')) {
      response.headers.set('Cache-Control', 'private, no-store');
      response.headers.set('Referrer-Policy', 'no-referrer');
    }
    return response;
  }

  if (isAuthenticated && isLoginRoute) {
    return copyAuthCookies(sessionHeaders, NextResponse.redirect(new URL('/', request.url)));
  }

  const response = copyAuthCookies(sessionHeaders, NextResponse.next());
  if (request.nextUrl.pathname.startsWith('/conexiones-ia/cambios/')) {
    response.headers.set('Cache-Control', 'private, no-store');
    response.headers.set('Referrer-Policy', 'no-referrer');
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
