import { createMiddleware } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';

/**
 * Request ID middleware — reads `x-request-id` header or generates a UUID.
 *
 * Wired to every typed server function through `typedServerFn`. The request ID
 * is available through both TanStack context and AsyncLocalStorage, allowing
 * the logger to enrich entries without handler changes.
 */
export const requestIdMiddleware = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const { requestContextStorage } = await import('@/lib/request-context-store');
    const requestId = getRequestHeaders().get('x-request-id') ?? crypto.randomUUID();
    return requestContextStorage.run({ requestId }, () => next({ context: { requestId } }));
  },
);
