import { RATE_LIMITS } from '@/lib/rate-limiter';
import { serverFnMiddlewares, typedServerFn } from '@/lib/server-fn';
import { z } from 'zod';

const plainTextItem = z
  .string()
  .trim()
  .min(1, 'Action item is required')
  .max(500, 'Action item must be 500 characters or fewer')
  .refine((value) => !/[<>]/.test(value), 'Action items must be plain text');

export const RevisionActionItemInputSchema = z.object({
  itemText: plainTextItem,
  criterionId: z.coerce.number().int().positive().optional(),
});

export const RevisionActionItemsSchema = z.array(RevisionActionItemInputSchema).max(10);

export const UpdateRevisionActionItemSchema = z.object({
  itemId: z.coerce.number().int().positive(),
  addressed: z.boolean(),
});

export type RevisionActionItemInput = z.infer<typeof RevisionActionItemInputSchema>;
export type UpdateRevisionActionItemInput = z.infer<typeof UpdateRevisionActionItemSchema>;

export const updateRevisionActionItem = typedServerFn({ method: 'POST' })
  .middleware(serverFnMiddlewares(RATE_LIMITS.heavyMutation))
  .inputValidator(UpdateRevisionActionItemSchema)
  .handler(async ({ data }) => {
    const { updateRevisionActionItemHandler } = await import('./revision-action-items.server');
    return updateRevisionActionItemHandler({ data });
  });
