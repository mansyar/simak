import { randomBytes, createHash } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import type { Db } from '@/db';
import { getDb } from '@/db';
import { calendarFeedTokens, users } from '@/db/schema';
import { safeAuditLog } from '@/lib/audit';
import { ErrorCode, serverError } from '@/lib/errors';
import { getSessionFromHeaders } from './auth';
import type { CalendarFeedLifecycleSchema } from './calendar-feed';
import type { z } from 'zod';

type CalendarFeedLifecycleInput = z.infer<typeof CalendarFeedLifecycleSchema>;
type Transaction = Parameters<Parameters<Db['transaction']>[0]>[0];
type QueryDb = Db | Transaction;

const CALENDAR_FEED_PATH = '/api/calendar.ics';

function generateFeedToken(): string {
  return randomBytes(32).toString('base64url');
}

function hashFeedToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function feedUrl(token: string): string {
  return `${CALENDAR_FEED_PATH}?token=${encodeURIComponent(token)}`;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === '23505'
  );
}

async function hasActiveStudent(db: QueryDb, studentId: string): Promise<boolean> {
  const [student] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, studentId), eq(users.role, 'student'), isNull(users.deletedAt)))
    .limit(1);

  return Boolean(student);
}

async function getAuthorizedStudent() {
  const session = await getSessionFromHeaders();
  if (!session || session.user.role !== 'student') {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  return { userId: session.user.id } as const;
}

export async function enableCalendarFeedHandler(args: { data: CalendarFeedLifecycleInput }) {
  void args;
  const authorized = await getAuthorizedStudent();
  if ('error' in authorized) return authorized;

  try {
    const db = getDb();
    const result = await db.transaction(async (tx) => {
      if (!(await hasActiveStudent(tx, authorized.userId))) return null;

      const [active] = await tx
        .select({ id: calendarFeedTokens.id })
        .from(calendarFeedTokens)
        .where(
          and(
            eq(calendarFeedTokens.studentId, authorized.userId),
            isNull(calendarFeedTokens.revokedAt),
          ),
        )
        .limit(1);

      if (active) return { enabled: true, feedUrl: null };

      const token = generateFeedToken();
      const [created] = await tx
        .insert(calendarFeedTokens)
        .values({ studentId: authorized.userId, tokenHash: hashFeedToken(token) })
        .returning({ id: calendarFeedTokens.id });

      return { enabled: true, feedUrl: feedUrl(token), tokenId: created.id };
    });

    if (!result) return serverError(ErrorCode.NOT_FOUND, 'Calendar feed unavailable');
    if (!result.feedUrl || !result.tokenId) return result;

    await safeAuditLog('calendar-feed-enabled', {
      actorId: authorized.userId,
      action: 'calendar_feed_enabled',
      entityType: 'calendar_feed_token',
      entityId: result.tokenId,
      details: { enabled: true },
    });

    return { enabled: true, feedUrl: result.feedUrl };
  } catch (error) {
    if (isUniqueViolation(error)) return { enabled: true, feedUrl: null };
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: error instanceof Error ? error.message : String(error),
      handler: 'enableCalendarFeedHandler',
      userId: authorized.userId,
    });
  }
}

export async function getCalendarFeedStatusHandler() {
  const authorized = await getAuthorizedStudent();
  if ('error' in authorized) return authorized;

  try {
    const db = getDb();
    const result = await db.transaction(async (tx) => {
      if (!(await hasActiveStudent(tx, authorized.userId))) return null;

      const [active] = await tx
        .select({ id: calendarFeedTokens.id })
        .from(calendarFeedTokens)
        .where(
          and(
            eq(calendarFeedTokens.studentId, authorized.userId),
            isNull(calendarFeedTokens.revokedAt),
          ),
        )
        .limit(1);

      return Boolean(active);
    });

    if (result === null) return serverError(ErrorCode.NOT_FOUND, 'Calendar feed unavailable');
    return { enabled: result };
  } catch (error) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: error instanceof Error ? error.message : String(error),
      handler: 'getCalendarFeedStatusHandler',
      userId: authorized.userId,
    });
  }
}

export async function regenerateCalendarFeedHandler(args: { data: CalendarFeedLifecycleInput }) {
  void args;
  const authorized = await getAuthorizedStudent();
  if ('error' in authorized) return authorized;

  try {
    const db = getDb();
    const result = await db.transaction(async (tx) => {
      if (!(await hasActiveStudent(tx, authorized.userId))) return null;

      const [active] = await tx
        .select({ id: calendarFeedTokens.id })
        .from(calendarFeedTokens)
        .where(
          and(
            eq(calendarFeedTokens.studentId, authorized.userId),
            isNull(calendarFeedTokens.revokedAt),
          ),
        )
        .limit(1);

      if (!active) return { missing: true as const };

      const [revoked] = await tx
        .update(calendarFeedTokens)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(calendarFeedTokens.id, active.id),
            eq(calendarFeedTokens.studentId, authorized.userId),
            isNull(calendarFeedTokens.revokedAt),
          ),
        )
        .returning({ id: calendarFeedTokens.id });

      if (!revoked) return { missing: true as const };

      const token = generateFeedToken();
      const [created] = await tx
        .insert(calendarFeedTokens)
        .values({ studentId: authorized.userId, tokenHash: hashFeedToken(token) })
        .returning({ id: calendarFeedTokens.id });

      return { enabled: true, feedUrl: feedUrl(token), tokenId: created.id };
    });

    if (!result) return serverError(ErrorCode.NOT_FOUND, 'Calendar feed unavailable');
    if ('missing' in result)
      return serverError(ErrorCode.NOT_FOUND, 'Calendar feed is not enabled');

    await safeAuditLog('calendar-feed-regenerated', {
      actorId: authorized.userId,
      action: 'calendar_feed_regenerated',
      entityType: 'calendar_feed_token',
      entityId: result.tokenId,
      details: { enabled: true },
    });

    return { enabled: true, feedUrl: result.feedUrl };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return serverError(ErrorCode.CONFLICT, 'Calendar feed could not be regenerated');
    }
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: error instanceof Error ? error.message : String(error),
      handler: 'regenerateCalendarFeedHandler',
      userId: authorized.userId,
    });
  }
}

export async function revokeCalendarFeedHandler(args: { data: CalendarFeedLifecycleInput }) {
  void args;
  const authorized = await getAuthorizedStudent();
  if ('error' in authorized) return authorized;

  try {
    const db = getDb();
    const result = await db.transaction(async (tx) => {
      if (!(await hasActiveStudent(tx, authorized.userId))) return null;

      const [revoked] = await tx
        .update(calendarFeedTokens)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(calendarFeedTokens.studentId, authorized.userId),
            isNull(calendarFeedTokens.revokedAt),
          ),
        )
        .returning({ id: calendarFeedTokens.id });

      return revoked?.id ?? null;
    });

    if (result === null) return serverError(ErrorCode.NOT_FOUND, 'Calendar feed unavailable');
    if (result) {
      await safeAuditLog('calendar-feed-revoked', {
        actorId: authorized.userId,
        action: 'calendar_feed_revoked',
        entityType: 'calendar_feed_token',
        entityId: result,
        details: { enabled: false },
      });
    }

    return { enabled: false };
  } catch (error) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: error instanceof Error ? error.message : String(error),
      handler: 'revokeCalendarFeedHandler',
      userId: authorized.userId,
    });
  }
}
