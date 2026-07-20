import type { Session } from './auth';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { eq, and, isNull } from 'drizzle-orm';
import { auth } from '../auth/config';
import { getDb } from '../db/index';
import { users } from '../db/schema/users';

type UserRole = 'superadmin' | 'admin' | 'instructor' | 'student';

const SESSION_CACHE_TTL_MS = 5000;

interface SessionCacheEntry {
  role: UserRole;
  locale: string;
  expiresAt: number;
}

const sessionCache = new Map<string, SessionCacheEntry>();

/** Clear the session cache (test-only). */
export function clearSessionCacheForTests(): void {
  sessionCache.clear();
}

/** Build a Session return value from the Better Auth payload and role/locale fallback. */
function buildSession(u: NonNullable<Session>, role: UserRole, locale: string): Session {
  const payloadRole = u.user.role as UserRole | undefined;
  const payloadLocale = u.user.locale as string | undefined;

  return {
    user: {
      id: u.user.id,
      name: u.user.name,
      email: u.user.email,
      role: payloadRole ?? role,
      locale: payloadLocale ?? locale,
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

export async function getSessionHandler(): Promise<Session> {
  const headers = getRequestHeaders();
  const result = await auth.api.getSession({ headers });

  if (!result) {
    return null;
  }

  const u = result as unknown as NonNullable<Session>;
  const userId = u.user.id;

  // Check session cache before querying the database.
  // The cache sits between auth.api.getSession() (always called — security-critical)
  // and the DB role/locale lookup (redundant across server-function calls within a page load).
  const now = Date.now();
  const cached = sessionCache.get(userId);

  if (cached && now < cached.expiresAt) {
    // Cache hit — skip the DB query. Soft-delete check is skipped by design (see spec Decisions).
    return buildSession(u, cached.role, cached.locale);
  }

  // Cache miss — evict expired entry (lazy eviction) before querying DB.
  if (cached) {
    sessionCache.delete(userId);
  }

  // Verify the user is still active and fetch role/locale fallback values.
  // When Better Auth returns enriched role/locale via additionalFields, we
  // use those values but still validate that the user has not been soft-deleted.
  const db = getDb();
  const userRecord = await db
    .select({ role: users.role, locale: users.locale })
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .then((rows) => rows[0]);

  if (!userRecord) {
    return null;
  }

  // Cache the DB result for subsequent calls within the TTL window.
  const dbRole = userRecord.role as UserRole;
  const dbLocale = userRecord.locale as string;

  sessionCache.set(userId, {
    role: dbRole,
    locale: dbLocale,
    expiresAt: now + SESSION_CACHE_TTL_MS,
  });

  return buildSession(u, dbRole, dbLocale);
}
