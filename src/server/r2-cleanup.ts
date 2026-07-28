import { typedServerFn } from '@/lib/server-fn';
import { z } from 'zod';

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

export const triggerR2Cleanup = typedServerFn({ method: 'POST' })
  .inputValidator(TriggerR2CleanupSchema)
  .handler(async ({ data }) => {
    const { triggerR2CleanupHandler } = await import('./r2-cleanup.server');
    return triggerR2CleanupHandler({ data });
  });
