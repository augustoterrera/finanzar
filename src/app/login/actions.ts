'use server';

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createSession, SESSION_COOKIE_NAME } from '@/lib/auth';

export async function loginAction(prevState: any, formData: FormData) {
  const password = formData.get('password');
  const appPassword = process.env.APP_PASSWORD;

  if (!password || password !== appPassword) {
    return { error: 'Contraseña incorrecta' };
  }

  const sessionSig = await createSession();
  
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, sessionSig, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 30 // 30 days
  });

  redirect('/');
}
