import { createMiddleware } from '@tanstack/react-start';
import { logger, type Logger } from '@/lib/logger';

export const requestIdMiddleware = createMiddleware({ type: 'request' }).server(
  async ({ next, request }) => {
    const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
    return next({ context: { requestId } });
  },
);

export function createRequestLogger(context: { requestId: string }): Logger {
  return logger.child({ requestId: context.requestId });
}
