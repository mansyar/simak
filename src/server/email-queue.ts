import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

// ---- Schemas ----

export const ListEmailQueueSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  status: z.enum(['all', 'pending', 'processing', 'sent', 'failed']).default('all'),
  search: z.string().default(''),
});

export type ListEmailQueueInput = z.infer<typeof ListEmailQueueSchema>;

export const RetryEmailSchema = z.object({
  emailId: z.number().int().positive(),
});

export type RetryEmailInput = z.infer<typeof RetryEmailSchema>;

// ---- Server Function Stubs ----

export const listEmailQueue = createServerFn({ method: 'GET' })
  .inputValidator(ListEmailQueueSchema)
  .handler(async ({ data }) => {
    const { listEmailQueueHandler } = await import('./email-queue.server');
    return listEmailQueueHandler({ data });
  });

export const retryEmail = createServerFn({ method: 'POST' })
  .inputValidator(RetryEmailSchema)
  .handler(async ({ data }) => {
    const { retryEmailHandler } = await import('./email-queue.server');
    return retryEmailHandler({ data });
  });
