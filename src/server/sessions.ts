// Client-safe server function wrappers (Zod schemas + typedServerFn stubs)
// Handler implementations are in sessions.server.ts (not bundled for client)
import { RATE_LIMITS } from '@/lib/rate-limiter';
import { serverFnMiddlewares, typedServerFn } from '@/lib/server-fn';
import { z } from 'zod';
import {
  listActiveSessionsHandler,
  revokeAllOtherSessionsHandler,
  revokeSessionHandler,
} from './sessions.server';

export const RevokeSessionSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
});

export const listActiveSessions = typedServerFn({
  method: 'GET',
})
  .middleware(serverFnMiddlewares(RATE_LIMITS.standardRead))
  .handler(async () => {
    return listActiveSessionsHandler();
  });

export const revokeSession = typedServerFn({
  method: 'POST',
})
  .middleware(serverFnMiddlewares(RATE_LIMITS.destructive))
  .handler(async (args: { data: unknown }) => {
    const data = RevokeSessionSchema.parse(args.data);
    return revokeSessionHandler({ data });
  });

export const revokeAllOtherSessions = typedServerFn({
  method: 'POST',
})
  .middleware(serverFnMiddlewares(RATE_LIMITS.destructive))
  .handler(async () => {
    return revokeAllOtherSessionsHandler();
  });
