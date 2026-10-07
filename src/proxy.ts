import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isValidSession, SESSION_COOKIE_NAME } from './lib/auth';

export async function proxy(request: NextRequest) {
  const sessionId = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const isAuthenticated = await isValidSession(sessionId);
  const isLoginRoute = request.nextUrl.pathname === '/login';

  if (!isAuthenticated && !isLoginRoute) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (isAuthenticated && isLoginRoute) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
