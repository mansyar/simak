import type { Session } from './auth';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { eq, and, isNull } from 'drizzle-orm';
import { auth } from '../auth/config';
import { getDb } from '../db/index';
import { users } from '../db/schema/users';

export async function getSessionHandler(): Promise<Session> {
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
}
