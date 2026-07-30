import { RATE_LIMITS } from '@/lib/rate-limiter';
import { serverFnMiddlewares, typedServerFn } from '@/lib/server-fn';
import { z } from 'zod';
import { triggerR2CleanupHandler } from './r2-cleanup.server';

// ---- Schemas ----

export const TriggerR2CleanupSchema = z.object({});

export type TriggerR2CleanupInput = z.infer<typeof TriggerR2CleanupSchema>;

// ---- Types (client-safe, shared between server handlers and UI) ----

export type R2CleanupSummary = {
  deleted: number;
  failed: number;
  batchSize: number;
};

// ---- Server Function Stubs ----

export const triggerR2Cleanup = typedServerFn({
  method: 'POST',
})
  .middleware(serverFnMiddlewares(RATE_LIMITS.destructive))
  .inputValidator(TriggerR2CleanupSchema)
  .handler(async ({ data }) => {
    return triggerR2CleanupHandler({ data });
  });
