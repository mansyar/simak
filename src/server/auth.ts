import { createServerFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { redirect } from '@tanstack/react-router';
import { auth } from '../auth/config';

export type Session = {
  user: {
    id: string;
    name: string;
    email: string;
    role: 'superadmin' | 'admin' | 'instructor' | 'student';
    locale: string;
    emailVerified: boolean;
    image?: string | null;
  };
  session: {
    id: string;
    token: string;
    expiresAt: Date;
  };
} | null;

const _getSession = createServerFn({ method: 'GET' }).handler(async () => {
  const headers = getRequestHeaders();
  const result = await auth.api.getSession({ headers });

  if (!result) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const u = result as any;

  return {
    user: {
      id: u.user.id,
      name: u.user.name,
      email: u.user.email,
      role: (u.user.role ?? 'student') as 'superadmin' | 'admin' | 'instructor' | 'student',
      locale: u.user.locale ?? 'en',
      emailVerified: Boolean(u.user.emailVerified),
      image: u.user.image as string | undefined | null,
    },
    session: {
      id: u.session.id,
      token: u.session.token,
      expiresAt: u.session.expiresAt,
    },
  };
});

export async function getSessionFromHeaders(): Promise<Session> {
  return _getSession();
}

export async function requireRole(roles: string[]): Promise<Session> {
  const session = await getSessionFromHeaders();

  if (!session) {
    throw redirect({ to: '/auth/login' as unknown as '.' });
  }

  if (!roles.includes(session.user.role)) {
    throw redirect({ to: '/dashboard' as unknown as '.' });
  }

  return session;
}
