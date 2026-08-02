/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import { getDb } from '@/db';
import { auditLog, calendarFeedTokens, users } from '@/db/schema';
import * as auth from '@/server/auth';
import {
  enableCalendarFeedHandler,
  getCalendarFeedStatusHandler,
  regenerateCalendarFeedHandler,
  revokeCalendarFeedHandler,
} from '@/server/calendar-feed.server';

vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn(),
}));

describe('calendar feed token lifecycle', () => {
  const db = getDb();
  const userId = `calendar-lifecycle-${Date.now()}`;
  const email = `${userId}@test.com`;
  const session = {
    user: {
      id: userId,
      role: 'student' as const,
      name: 'Calendar Lifecycle Student',
      email,
      image: null,
    },
    session: {},
  };

  beforeEach(async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(session as never);
    await db.insert(users).values({
      id: userId,
      name: session.user.name,
      email,
      role: 'student',
      settings: { reducedMotion: true, timezone: 'Asia/Tokyo' },
    });
  });

  afterEach(async () => {
    await db.delete(auditLog).where(eq(auditLog.actorId, userId));
    await db.delete(calendarFeedTokens).where(eq(calendarFeedTokens.studentId, userId));
    await db.delete(users).where(eq(users.id, userId));
  });

  it('persists only hashes, rotates atomically, revokes, and preserves unrelated state', async () => {
    const enabled = await enableCalendarFeedHandler({ data: {} });
    expect(enabled).toMatchObject({ enabled: true });
    if ('error' in enabled || !enabled.feedUrl) return;

    const firstToken = new URL(`https://example.test${enabled.feedUrl}`).searchParams.get('token');
    expect(firstToken).toHaveLength(43);
    const [firstRow] = await db
      .select()
      .from(calendarFeedTokens)
      .where(eq(calendarFeedTokens.studentId, userId));
    expect(firstRow.tokenHash).toBe(
      createHash('sha256')
        .update(firstToken as string)
        .digest('hex'),
    );
    expect(firstRow.tokenHash).not.toBe(firstToken);

    await expect(getCalendarFeedStatusHandler()).resolves.toEqual({ enabled: true });

    const regenerated = await regenerateCalendarFeedHandler({ data: {} });
    expect(regenerated).toMatchObject({ enabled: true });
    if ('error' in regenerated || !regenerated.feedUrl) return;

    const secondToken = new URL(`https://example.test${regenerated.feedUrl}`).searchParams.get(
      'token',
    );
    expect(secondToken).toHaveLength(43);
    expect(secondToken).not.toBe(firstToken);

    const rowsAfterRotation = await db
      .select()
      .from(calendarFeedTokens)
      .where(eq(calendarFeedTokens.studentId, userId));
    expect(rowsAfterRotation).toHaveLength(2);
    expect(rowsAfterRotation.filter((row) => row.revokedAt === null)).toHaveLength(1);
    expect(
      rowsAfterRotation.some((row) => row.tokenHash === firstRow.tokenHash && row.revokedAt),
    ).toBe(true);

    await expect(revokeCalendarFeedHandler({ data: {} })).resolves.toEqual({ enabled: false });
    await expect(getCalendarFeedStatusHandler()).resolves.toEqual({ enabled: false });

    const [user] = await db
      .select({ settings: users.settings })
      .from(users)
      .where(eq(users.id, userId));
    expect(user.settings).toEqual({ reducedMotion: true, timezone: 'Asia/Tokyo' });

    const events = await db
      .select({ action: auditLog.action, details: auditLog.details })
      .from(auditLog)
      .where(inArray(auditLog.actorId, [userId]));
    expect(events.map((event) => event.action)).toEqual([
      'calendar_feed_enabled',
      'calendar_feed_regenerated',
      'calendar_feed_revoked',
    ]);
    expect(JSON.stringify(events)).not.toContain(firstToken as string);
    expect(JSON.stringify(events)).not.toContain(secondToken as string);
  });
});
