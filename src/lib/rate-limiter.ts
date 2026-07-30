import { createMiddleware } from '@tanstack/react-start';
import { getSessionFromHeaders } from '@/server/auth';
import { serverError, ErrorCode } from '@/lib/errors';

export type RateLimitConfig = {
  window: number;
  max: number;
};

export const RATE_LIMITS = {
  presignedUrl: { window: 60, max: 20 },
  heavyMutation: { window: 60, max: 10 },
  destructive: { window: 60, max: 5 },
  standardRead: { window: 60, max: 60 },
} as const;

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

export function checkRateLimit(
  store: Map<string, RateLimitEntry>,
  key: string,
  config: RateLimitConfig,
): boolean {
  const now = Date.now();
  const entry = store.get(key);

  if (entry && now - entry.windowStart < config.window * 1000) {
    if (entry.count >= config.max) {
      return false;
    }
    entry.count++;
    return true;
  }

  store.set(key, { count: 1, windowStart: now });
  return true;
}

let fnIdCounter = 0;

export function createRateLimitMiddleware(config: RateLimitConfig) {
  const fnId = ++fnIdCounter;

  return createMiddleware({ type: 'request' }).server(async ({ next }) => {
    const session = await getSessionFromHeaders();

    if (!session) {
      return next();
    }

    const key = `${session.user.id}:${fnId}`;

    if (!checkRateLimit(rateLimitStore, key, config)) {
      return serverError(ErrorCode.RATE_LIMITED, 'Rate limit exceeded') as never;
    }

    return next();
  });
}

export function resetRateLimitStoreForTests(): void {
  rateLimitStore.clear();
}
