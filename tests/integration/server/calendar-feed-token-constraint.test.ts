/** @vitest-environment node */
import { afterEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db/index';
import { calendarFeedTokens, users } from '@/db/schema';

describe('calendar feed token database invariant', () => {
  const db = getDb();
  const userId = `calendar-feed-${Date.now()}`;

  afterEach(async () => {
    await db.delete(calendarFeedTokens).where(eq(calendarFeedTokens.studentId, userId));
    await db.delete(users).where(eq(users.id, userId));
  });

  it('allows only one active token for a student under concurrent inserts', async () => {
    await db.insert(users).values({
      id: userId,
      name: 'Calendar Feed Student',
      email: `${userId}@test.com`,
      role: 'student',
    });

    const results = await Promise.allSettled([
      db.insert(calendarFeedTokens).values({ studentId: userId, tokenHash: 'hash-a' }),
      db.insert(calendarFeedTokens).values({ studentId: userId, tokenHash: 'hash-b' }),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
  });
});
