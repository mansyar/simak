// Client-safe server function wrappers (Zod schemas + typedServerFn stubs)
// Handler implementations are in setup-password.server.ts (not bundled for client)
import { serverFnMiddlewares, typedServerFn } from '@/lib/server-fn';
import { z } from 'zod';
import { completePasswordSetupHandler } from './setup-password.server';

export const SetupPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

export const completePasswordSetup = typedServerFn({ method: 'POST' })
  .middleware(serverFnMiddlewares())
  .inputValidator(SetupPasswordSchema)
  .handler(async ({ data }) => {
    return completePasswordSetupHandler({ data });
  });
