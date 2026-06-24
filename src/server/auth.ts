import { createServerFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { redirect } from '@tanstack/react-router';
import { eq, and, isNull } from 'drizzle-orm';
import { auth } from '../auth/config';
import { getDb } from '../db/index';
import { users } from '../db/schema/users';
import { getRoleDashboard } from '../lib/route-utils';

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

  if (!result) {
    return null;
  }

  const u = result as unknown as NonNullable<Session>;

  // Verify the user is still active and fetch role/locale fallback values.
  // When Better Auth returns enriched role/locale via additionalFields, we
  // use those values but still validate that the user has not been soft-deleted.
  const db = getDb();
  const userRecord = await db
    .select({ role: users.role, locale: users.locale })
    .from(users)
    .where(and(eq(users.id, u.user.id), isNull(users.deletedAt)))
    .then((rows) => rows[0]);

  if (!userRecord) {
    return null;
  }

  const payloadRole = u.user.role as 'superadmin' | 'admin' | 'instructor' | 'student' | undefined;
  const payloadLocale = u.user.locale as string | undefined;

  return {
    user: {
      id: u.user.id,
      name: u.user.name,
      email: u.user.email,
      role: payloadRole ?? (userRecord.role as 'superadmin' | 'admin' | 'instructor' | 'student'),
      locale: payloadLocale ?? (userRecord.locale as string),
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
    throw redirect({ to: getRoleDashboard(session.user.role) as unknown as '.' });
  }

  return session;
}
