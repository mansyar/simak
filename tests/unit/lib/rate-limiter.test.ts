/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@tanstack/react-start', () => ({
  createMiddleware: vi.fn().mockReturnValue({
    server: vi.fn().mockImplementation((fn) => fn),
  }),
}));

vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

import { getSessionFromHeaders } from '@/server/auth';
import {
  RATE_LIMITS,
  MAX_RATE_LIMIT_ENTRIES,
  checkRateLimit,
  createRateLimitMiddleware,
  resetRateLimitStoreForTests,
  type RateLimitConfig,
} from '@/lib/rate-limiter';

type MiddlewareFn = (opts: { next: ReturnType<typeof vi.fn> }) => Promise<unknown>;

const createMiddleware = (config: RateLimitConfig): MiddlewareFn =>
  createRateLimitMiddleware(config) as unknown as MiddlewareFn;

describe('RATE_LIMITS presets', () => {
  it('presignedUrl is 20 req per 60s', () => {
    expect(RATE_LIMITS.presignedUrl).toEqual({ window: 60, max: 20 });
  });

  it('heavyMutation is 10 req per 60s', () => {
    expect(RATE_LIMITS.heavyMutation).toEqual({ window: 60, max: 10 });
  });

  it('destructive is 5 req per 60s', () => {
    expect(RATE_LIMITS.destructive).toEqual({ window: 60, max: 5 });
  });

  it('standardRead is 60 req per 60s', () => {
    expect(RATE_LIMITS.standardRead).toEqual({ window: 60, max: 60 });
  });
});

describe('checkRateLimit', () => {
  let store: Map<string, { count: number; windowStart: number }>;
  const config: RateLimitConfig = { window: 60, max: 3 };

  beforeEach(() => {
    store = new Map();
  });

  it('allows requests up to max within the window', () => {
    expect(checkRateLimit(store, 'user1:fn1', config)).toBe(true);
    expect(checkRateLimit(store, 'user1:fn1', config)).toBe(true);
    expect(checkRateLimit(store, 'user1:fn1', config)).toBe(true);
  });

  it('denies when count >= max (returns false, does NOT increment)', () => {
    checkRateLimit(store, 'user1:fn1', config); // count 1
    checkRateLimit(store, 'user1:fn1', config); // count 2
    checkRateLimit(store, 'user1:fn1', config); // count 3

    expect(checkRateLimit(store, 'user1:fn1', config)).toBe(false);

    // Subsequent calls still denied — count not incremented beyond max
    expect(checkRateLimit(store, 'user1:fn1', config)).toBe(false);
  });

  it('resets after window expiry', () => {
    const now = Date.now();
    vi.useFakeTimers();
    vi.setSystemTime(now);

    checkRateLimit(store, 'user1:fn1', config); // count 1
    checkRateLimit(store, 'user1:fn1', config); // count 2
    checkRateLimit(store, 'user1:fn1', config); // count 3
    expect(checkRateLimit(store, 'user1:fn1', config)).toBe(false);

    // Advance past window
    vi.advanceTimersByTime(61 * 1000);

    expect(checkRateLimit(store, 'user1:fn1', config)).toBe(true);

    vi.useRealTimers();
  });

  it('per-key isolation — different keys have independent counters', () => {
    const cfg: RateLimitConfig = { window: 60, max: 2 };

    expect(checkRateLimit(store, 'user1:fn1', cfg)).toBe(true);
    expect(checkRateLimit(store, 'user1:fn1', cfg)).toBe(true);
    expect(checkRateLimit(store, 'user1:fn1', cfg)).toBe(false); // user1:fn1 exhausted

    // user2:fn1 is independent
    expect(checkRateLimit(store, 'user2:fn1', cfg)).toBe(true);
    // user1:fn2 is independent
    expect(checkRateLimit(store, 'user1:fn2', cfg)).toBe(true);
  });

  it('bounds the number of stored keys', () => {
    const cfg: RateLimitConfig = { window: 60, max: 1 };

    for (let index = 0; index <= MAX_RATE_LIMIT_ENTRIES; index++) {
      checkRateLimit(store, `key-${index}`, cfg);
    }

    expect(store.size).toBeLessThanOrEqual(MAX_RATE_LIMIT_ENTRIES);
  });
});

describe('createRateLimitMiddleware', () => {
  const config: RateLimitConfig = { window: 60, max: 2 };

  beforeEach(() => {
    vi.clearAllMocks();
    resetRateLimitStoreForTests();
  });

  it('passes through (calls next) when getSessionFromHeaders returns null (unauthenticated)', async () => {
    vi.mocked(getSessionFromHeaders).mockResolvedValue(null);
    const middleware = createMiddleware(config);
    const mockNext = vi.fn().mockResolvedValue({ ok: true });

    await middleware({ next: mockNext });

    expect(mockNext).toHaveBeenCalledOnce();
  });

  it('allows (calls next) when under the limit', async () => {
    vi.mocked(getSessionFromHeaders).mockResolvedValue({
      user: { id: 'user-1' },
      session: {},
    } as any);
    const middleware = createMiddleware(config);
    const mockNext = vi.fn().mockResolvedValue({ ok: true });

    await middleware({ next: mockNext });

    expect(mockNext).toHaveBeenCalledOnce();
  });

  it('short-circuits by throwing serverError(RATE_LIMITED) when limit exceeded', async () => {
    vi.mocked(getSessionFromHeaders).mockResolvedValue({
      user: { id: 'user-1' },
      session: {},
    } as any);
    const middleware = createMiddleware(config);
    const mockNext = vi.fn().mockResolvedValue({ ok: true });

    // Use up the limit (max: 2)
    await middleware({ next: mockNext });
    await middleware({ next: mockNext });

    // Third call should short-circuit
    expect(mockNext).toHaveBeenCalledTimes(2); // NOT called on 3rd
    await expect(middleware({ next: mockNext })).rejects.toEqual({
      error: { code: 'RATE_LIMITED', message: 'Rate limit exceeded' },
    });
  });

  it('each createRateLimitMiddleware call generates a unique fnId (per-function isolation)', async () => {
    vi.mocked(getSessionFromHeaders).mockResolvedValue({
      user: { id: 'user-1' },
      session: {},
    } as any);

    const middlewareA = createMiddleware(config);
    const middlewareB = createMiddleware(config);
    const mockNextA = vi.fn().mockResolvedValue({ ok: true });
    const mockNextB = vi.fn().mockResolvedValue({ ok: true });

    // Exhaust middlewareA's limit (max: 2)
    await middlewareA({ next: mockNextA });
    await middlewareA({ next: mockNextA });
    await expect(middlewareA({ next: mockNextA })).rejects.toEqual({
      error: { code: 'RATE_LIMITED', message: 'Rate limit exceeded' },
    });

    // middlewareB has its own counter — should still be allowed
    const resultB = await middlewareB({ next: mockNextB });
    expect(mockNextB).toHaveBeenCalledOnce();
    expect(resultB).toEqual({ ok: true });
  });
});
