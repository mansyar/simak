import { createServerFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { redirect } from '@tanstack/react-router';
import { eq } from 'drizzle-orm';
import { auth } from '../auth/config';
import { getDb } from '../db/index';
import { users } from '../db/schema/users';
import { getRoleDashboard } from '../lib/route-utils';
const _getSession = createServerFn({ method: 'GET' }).handler(async () => {
  const headers = getRequestHeaders();
  const result = await auth.api.getSession({ headers });
  if (!result) {
    return null;
  }
  const u = result;
  // Query the database directly for role and locale since Better Auth
  // session doesn't include additional fields by default
  const db = getDb();
  const userRecord = await db
    .select({ role: users.role, locale: users.locale })
    .from(users)
    .where(eq(users.id, u.user.id))
    .then((rows) => rows[0]);
  return {
    user: {
      id: u.user.id,
      name: u.user.name,
      email: u.user.email,
      role: userRecord?.role ?? 'student',
      locale: userRecord?.locale ?? 'en',
      emailVerified: Boolean(u.user.emailVerified),
      image: u.user.image,
    },
    session: {
      id: u.session.id,
      token: u.session.token,
      expiresAt: u.session.expiresAt,
    },
  };
});
export async function getSessionFromHeaders() {
  return _getSession();
}
export async function requireRole(roles) {
  const session = await getSessionFromHeaders();
  if (!session) {
    throw redirect({ to: '/auth/login' });
  }
  if (!roles.includes(session.user.role)) {
    throw redirect({ to: getRoleDashboard(session.user.role) });
  }
  return session;
}
