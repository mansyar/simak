import { createMiddleware } from '@tanstack/react-start';
import { logger, type Logger } from '@/lib/logger';

/**
 * Request ID middleware — reads `x-request-id` header or generates a UUID.
 *
 * NOTE: This middleware is defined and tested but not yet wired to server
 * functions. Full integration requires extending `typedServerFn` in
 * `src/lib/server-fn.ts` to chain `.middleware([requestIdMiddleware])` and
 * threading `requestId` through stub handlers to `.server.ts` handler
 * signatures. Until then, only background jobs propagate `requestId` (via
 * `logger.child({ requestId: crypto.randomUUID() })`). Tracked as future work.
 */
export const requestIdMiddleware = createMiddleware({ type: 'request' }).server(
  async ({ next, request }) => {
    const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
    return next({ context: { requestId } });
  },
);

export function createRequestLogger(context: { requestId: string }): Logger {
  return logger.child({ requestId: context.requestId });
}
