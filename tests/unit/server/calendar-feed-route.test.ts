/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  tokenRows: [] as { tokenId: string; studentId: string }[],
  rateAllowed: true,
}));

const checkCalendarFeedRateLimit = vi.hoisted(() => vi.fn(() => state.rateAllowed));
const getCalendarFeedEvents = vi.hoisted(() => vi.fn(async () => []));
const serializeCalendarFeed = vi.hoisted(() => vi.fn(() => 'BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n'));

vi.mock('@/lib/rate-limiter', () => ({ checkCalendarFeedRateLimit }));
vi.mock('@/server/calendar-feed-selection.server', () => ({ getCalendarFeedEvents }));
vi.mock('@/lib/calendar-ics', () => ({ serializeCalendarFeed }));
vi.mock('@/db', () => ({
  getDb: vi.fn(() => ({
    select: vi.fn(() => ({
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn(async () => state.tokenRows),
    })),
  })),
}));

import { handleCalendarFeedRequest } from '@/server/calendar-feed-route.server';

const validToken = 'a'.repeat(43);

function request(options: { token?: string; authorization?: string; ip?: string } = {}) {
  const url = new URL('https://simak.example/api/calendar.ics');
  if (options.token !== undefined) url.searchParams.set('token', options.token);

  const headers = new Headers();
  if (options.authorization !== undefined) headers.set('Authorization', options.authorization);
  if (options.ip !== undefined) headers.set('x-forwarded-for', options.ip);

  return new Request(url, { headers });
}

describe('handleCalendarFeedRequest', () => {
  beforeEach(() => {
    state.tokenRows = [];
    state.rateAllowed = true;
    checkCalendarFeedRateLimit.mockClear();
    getCalendarFeedEvents.mockClear();
    serializeCalendarFeed.mockClear();
  });

  it('returns the same generic unauthorized response for missing, malformed, unknown, revoked, and inactive credentials', async () => {
    const responses = await Promise.all([
      handleCalendarFeedRequest(request()),
      handleCalendarFeedRequest(request({ token: 'too-short' })),
      handleCalendarFeedRequest(request({ token: validToken })),
    ]);
    state.tokenRows = [];
    const inactive = await handleCalendarFeedRequest(
      request({ authorization: `Bearer ${validToken}` }),
    );

    const responseBodies = await Promise.all(responses.map((response) => response.text()));
    expect(responses.map((response, index) => [response.status, responseBodies[index]])).toEqual([
      [401, 'Calendar feed unavailable'],
      [401, 'Calendar feed unavailable'],
      [401, 'Calendar feed unavailable'],
    ]);
    expect([inactive.status, await inactive.text()]).toEqual([401, 'Calendar feed unavailable']);
  });

  it('accepts a valid query bearer token and returns a private calendar response', async () => {
    state.tokenRows = [{ tokenId: 'token-row-1', studentId: 'student-1' }];
    const response = await handleCalendarFeedRequest(request({ token: validToken }));

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/calendar');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    expect(await response.text()).toContain('BEGIN:VCALENDAR');
    expect(getCalendarFeedEvents).toHaveBeenCalledWith(expect.anything(), 'student-1');
    expect(serializeCalendarFeed).toHaveBeenCalled();
  });

  it('accepts an Authorization bearer token without changing credential ownership checks', async () => {
    state.tokenRows = [{ tokenId: 'token-row-1', studentId: 'student-1' }];
    const response = await handleCalendarFeedRequest(
      request({ authorization: `Bearer ${validToken}`, ip: '203.0.113.10' }),
    );

    expect(response.status).toBe(200);
    expect(checkCalendarFeedRateLimit).toHaveBeenCalledWith('203.0.113.10');
  });

  it('returns a generic rate-limit response without requiring a session', async () => {
    state.rateAllowed = false;
    const response = await handleCalendarFeedRequest(
      request({ token: validToken, ip: '203.0.113.11' }),
    );

    expect(response.status).toBe(429);
    expect(await response.text()).toBe('Calendar feed temporarily unavailable');
    expect(getCalendarFeedEvents).not.toHaveBeenCalled();
  });
});
