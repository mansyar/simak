// Client-safe server function wrappers (Zod schemas + typedServerFn stubs)
// Handler implementations are in sessions.server.ts (not bundled for client)
import { RATE_LIMITS } from '@/lib/rate-limiter';
import { serverFnMiddlewares, typedServerFn } from '@/lib/server-fn';
import { z } from 'zod';

export const RevokeSessionSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
});

export const listActiveSessions = typedServerFn({
  method: 'GET',
})
  .middleware(serverFnMiddlewares(RATE_LIMITS.standardRead))
  .handler(async () => {
    const { listActiveSessionsHandler } = await import('./sessions.server');
    return listActiveSessionsHandler();
  });

export const revokeSession = typedServerFn({
  method: 'POST',
})
  .middleware(serverFnMiddlewares(RATE_LIMITS.destructive))
  .handler(async (args: { data: unknown }) => {
    const data = RevokeSessionSchema.parse(args.data);
    const { revokeSessionHandler } = await import('./sessions.server');
    return revokeSessionHandler({ data });
  });

export const revokeAllOtherSessions = typedServerFn({
  method: 'POST',
})
  .middleware(serverFnMiddlewares(RATE_LIMITS.destructive))
  .handler(async () => {
    const { revokeAllOtherSessionsHandler } = await import('./sessions.server');
    return revokeAllOtherSessionsHandler();
  });
