// Client-safe server function wrappers (Zod schemas + createServerFn stubs)
// Handler implementations are in sessions.server.ts (not bundled for client)
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

export const RevokeSessionSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
});

export const listActiveSessions = createServerFn({ method: 'GET' }).handler(async () => {
  const { listActiveSessionsHandler } = await import('./sessions.server');
  return listActiveSessionsHandler();
});

export const revokeSession = createServerFn({ method: 'POST' }).handler(
  async (args: { data: unknown }) => {
    const { revokeSessionHandler } = await import('./sessions.server');
    const data = RevokeSessionSchema.parse(args.data);
    return revokeSessionHandler({ data });
  },
);

export const revokeAllOtherSessions = createServerFn({
  method: 'POST',
}).handler(async () => {
  const { revokeAllOtherSessionsHandler } = await import('./sessions.server');
  return revokeAllOtherSessionsHandler();
});
