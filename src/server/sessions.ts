// Client-safe server function wrappers (Zod schemas + typedServerFn stubs)
// Handler implementations are in sessions.server.ts (not bundled for client)
import { RATE_LIMITS } from '@/lib/rate-limiter';
import { typedServerFn } from '@/lib/server-fn';
import { z } from 'zod';

export const RevokeSessionSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
});

export const listActiveSessions = typedServerFn({
  method: 'GET',
  rateLimit: RATE_LIMITS.standardRead,
}).handler(async () => {
  const { listActiveSessionsHandler } = await import('./sessions.server');
  return listActiveSessionsHandler();
});

export const revokeSession = typedServerFn({
  method: 'POST',
  rateLimit: RATE_LIMITS.destructive,
}).handler(async (args: { data: unknown }) => {
  const { revokeSessionHandler } = await import('./sessions.server');
  const data = RevokeSessionSchema.parse(args.data);
  return revokeSessionHandler({ data });
});

export const revokeAllOtherSessions = typedServerFn({
  method: 'POST',
  rateLimit: RATE_LIMITS.destructive,
}).handler(async () => {
  const { revokeAllOtherSessionsHandler } = await import('./sessions.server');
  return revokeAllOtherSessionsHandler();
});
