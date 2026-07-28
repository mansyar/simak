// Client-safe server function wrappers (Zod schemas + typedServerFn stubs)
// Handler implementations are in setup-password.server.ts (not bundled for client)
import { typedServerFn } from '@/lib/server-fn';
import { z } from 'zod';

export const SetupPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

export const completePasswordSetup = typedServerFn({ method: 'POST' })
  .inputValidator(SetupPasswordSchema)
  .handler(async ({ data }) => {
    const { completePasswordSetupHandler } = await import('./setup-password.server');
    return completePasswordSetupHandler({ data });
  });
