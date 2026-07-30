import { createMiddleware } from '@tanstack/react-start';
import { logger, type Logger } from '@/lib/logger';
import { requestContextStorage } from '@/lib/request-context-store';

/**
 * Request ID middleware — reads `x-request-id` header or generates a UUID.
 *
 * Wired to every typed server function through `typedServerFn`. The request ID
 * is available through both TanStack context and AsyncLocalStorage, allowing
 * the logger to enrich entries without handler changes.
 */
export const requestIdMiddleware = createMiddleware({ type: 'request' }).server(
  async ({ next, request }) => {
    const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
    return requestContextStorage.run({ requestId }, () => next({ context: { requestId } }));
  },
);

export function createRequestLogger(context: { requestId: string }): Logger {
  return logger.child({ requestId: context.requestId });
}
