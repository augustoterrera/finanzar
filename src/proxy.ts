import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from './lib/auth-provider';
import { copyAuthCookies } from './lib/auth-cookies';

export async function proxy(request: NextRequest) {
  const { response: session, headers: sessionHeaders } = await auth.api.getSession({
    headers: request.headers,
    returnHeaders: true,
  });
  const isAuthenticated = Boolean(session);
  const isLoginRoute = request.nextUrl.pathname.startsWith('/login');

  if (!isAuthenticated && !isLoginRoute) {
    return copyAuthCookies(sessionHeaders, NextResponse.redirect(new URL('/login', request.url)));
  }

  if (isAuthenticated && isLoginRoute) {
    return copyAuthCookies(sessionHeaders, NextResponse.redirect(new URL('/', request.url)));
  }

  return copyAuthCookies(sessionHeaders, NextResponse.next());
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
