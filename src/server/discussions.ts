// Client-safe server function wrappers (Zod schemas + createServerFn stubs)
// Handler implementations are in discussions.server.ts (not bundled for client)
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

// ---- Discussion Schemas ----

export const ListDiscussionMessagesSchema = z.object({
  checkpointId: z.coerce.number().int().positive('Checkpoint ID must be a positive integer'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const PostDiscussionMessageSchema = z.object({
  checkpointId: z.coerce.number().int().positive('Checkpoint ID must be a positive integer'),
  message: z.string().min(1, 'Message cannot be empty').max(2000, 'Message is too long'),
  parentMessageId: z.coerce.number().int().positive().optional(),
});

export const DeleteOwnMessageSchema = z.object({
  messageId: z.coerce.number().int().positive('Message ID must be a positive integer'),
});

// ---- Discussion Server Function Stubs ----

export const listDiscussionMessages = createServerFn({ method: 'GET' })
  .inputValidator(ListDiscussionMessagesSchema)
  .handler(async ({ data }) => {
    const { listDiscussionMessagesHandler } = await import('./discussions.server');
    return listDiscussionMessagesHandler({ data });
  });

export const postDiscussionMessage = createServerFn({ method: 'POST' })
  .inputValidator(PostDiscussionMessageSchema)
  .handler(async ({ data }) => {
    const { postDiscussionMessageHandler } = await import('./discussions.server');
    return postDiscussionMessageHandler({ data });
  });

export const deleteOwnMessage = createServerFn({ method: 'POST' })
  .inputValidator(DeleteOwnMessageSchema)
  .handler(async ({ data }) => {
    const { deleteOwnMessageHandler } = await import('./discussions.server');
    return deleteOwnMessageHandler({ data });
  });
