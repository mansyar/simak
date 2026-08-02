import { createHash } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { getDb } from '@/db';
import { calendarFeedTokens, users } from '@/db/schema';
import { serializeCalendarFeed } from '@/lib/calendar-ics';
import { checkCalendarFeedRateLimit } from '@/lib/rate-limiter';
import { getCalendarFeedEvents } from './calendar-feed-selection.server';

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const CALENDAR_HEADERS = {
  'Cache-Control': 'private, no-store',
  'Content-Type': 'text/calendar; charset=utf-8',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
};

function unavailableResponse(status = 401) {
  return new Response('Calendar feed unavailable', {
    status,
    headers: status === 200 ? CALENDAR_HEADERS : { 'Cache-Control': 'no-store' },
  });
}

function extractToken(request: Request): string | null {
  const authorization = request.headers.get('authorization');
  if (authorization !== null) {
    const match = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(authorization);
    return match?.[1] ?? null;
  }

  const token = new URL(request.url).searchParams.get('token');
  return token !== null && TOKEN_PATTERN.test(token) ? token : null;
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function rateLimitKey(request: Request) {
  return (
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'anonymous'
  );
}

export async function handleCalendarFeedRequest(request: Request): Promise<Response> {
  if (!checkCalendarFeedRateLimit(rateLimitKey(request))) {
    return new Response('Calendar feed temporarily unavailable', {
      status: 429,
      headers: { 'Cache-Control': 'no-store', 'Retry-After': '60' },
    });
  }

  const token = extractToken(request);
  if (!token) return unavailableResponse();

  try {
    const db = getDb();
    const [credential] = await db
      .select({ tokenId: calendarFeedTokens.id, studentId: calendarFeedTokens.studentId })
      .from(calendarFeedTokens)
      .innerJoin(users, eq(calendarFeedTokens.studentId, users.id))
      .where(
        and(
          eq(calendarFeedTokens.tokenHash, hashToken(token)),
          isNull(calendarFeedTokens.revokedAt),
          eq(users.role, 'student'),
          isNull(users.deletedAt),
        ),
      )
      .limit(1);

    if (!credential) return unavailableResponse();

    const events = await getCalendarFeedEvents(db, credential.studentId);
    return new Response(serializeCalendarFeed(events, new Date()), {
      status: 200,
      headers: CALENDAR_HEADERS,
    });
  } catch {
    return unavailableResponse(500);
  }
}
