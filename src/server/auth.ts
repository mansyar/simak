import { serverFnMiddlewares, typedServerFn } from '@/lib/server-fn';
import { redirect } from '@tanstack/react-router';
import { getRoleDashboard } from '../lib/route-utils';
import { isAuthenticated } from '../lib/session-guards';
import { getSessionHandler } from './auth.server';

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

const _getSession = typedServerFn({ method: 'GET' })
  .middleware(serverFnMiddlewares())
  .handler(async () => {
    return getSessionHandler();
  });

export async function getSessionFromHeaders(): Promise<Session> {
  return _getSession();
}

export async function requireRole(roles: string[]): Promise<Session> {
  const session = await getSessionFromHeaders();

  if (!isAuthenticated(session)) {
    throw redirect({ to: '/auth/login' as unknown as '.' });
  }

  if (!roles.includes(session.user.role)) {
    throw redirect({ to: getRoleDashboard(session.user.role) as unknown as '.' });
  }

  return session;
}
