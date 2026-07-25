// Server-only handlers (not imported by client code)
// TODO: Implement in tasks 4-6 (listDiscussionMessagesHandler, postDiscussionMessageHandler, deleteOwnMessageHandler)
import type { z } from 'zod';
import type {
  ListDiscussionMessagesSchema,
  PostDiscussionMessageSchema,
  DeleteOwnMessageSchema,
} from './discussions';

type ListDiscussionMessagesInput = z.infer<typeof ListDiscussionMessagesSchema>;
type PostDiscussionMessageInput = z.infer<typeof PostDiscussionMessageSchema>;
type DeleteOwnMessageInput = z.infer<typeof DeleteOwnMessageSchema>;

export async function listDiscussionMessagesHandler({
  data,
}: {
  data: ListDiscussionMessagesInput;
}) {
  throw new Error('listDiscussionMessagesHandler not implemented');
}

export async function postDiscussionMessageHandler({ data }: { data: PostDiscussionMessageInput }) {
  throw new Error('postDiscussionMessageHandler not implemented');
}

export async function deleteOwnMessageHandler({ data }: { data: DeleteOwnMessageInput }) {
  throw new Error('deleteOwnMessageHandler not implemented');
}
