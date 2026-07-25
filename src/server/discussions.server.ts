// Server-only handlers (not imported by client code)
import { eq, and, asc, isNull, isNotNull, or, sql } from 'drizzle-orm';
import { getDb } from '../db/index';
import { checkpointDiscussions } from '../db/schema/discussions';
import { users } from '../db/schema/users';
import { getSessionFromHeaders } from './auth';
import { verifyCheckpointAccess } from './ownership';
import { serverError, ErrorCode } from '../lib/errors';
import type { NonNullableSession } from '../lib/types';
import type { z } from 'zod';
import type {
  ListDiscussionMessagesSchema,
  PostDiscussionMessageSchema,
  DeleteOwnMessageSchema,
} from './discussions';

type ListDiscussionMessagesInput = z.infer<typeof ListDiscussionMessagesSchema>;
type PostDiscussionMessageInput = z.infer<typeof PostDiscussionMessageSchema>;
type DeleteOwnMessageInput = z.infer<typeof DeleteOwnMessageSchema>;

function isStudentOrInstructor(session: NonNullableSession | null): session is NonNullableSession {
  return !!session && (session.user.role === 'student' || session.user.role === 'instructor');
}

export async function listDiscussionMessagesHandler({
  data,
}: {
  data: ListDiscussionMessagesInput;
}) {
  const session = await getSessionFromHeaders();
  if (!isStudentOrInstructor(session)) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const { checkpointId, page, limit } = data;
  const db = getDb();

  try {
    // 1. Verify checkpoint ownership (student owns checkpoint OR instructor owns assignment)
    const accessError = await verifyCheckpointAccess(db, checkpointId, session);
    if (accessError) return accessError;

    // 2. Fetch messages (paginated) and total count in parallel
    // Exclude soft-deleted top-level messages, but include replies to deleted parents
    const [messageList, [{ count }]] = await Promise.all([
      db
        .select({
          id: checkpointDiscussions.id,
          message: checkpointDiscussions.message,
          userId: checkpointDiscussions.userId,
          authorName: users.name,
          authorRole: users.role,
          parentMessageId: checkpointDiscussions.parentMessageId,
          createdAt: checkpointDiscussions.createdAt,
          deletedAt: checkpointDiscussions.deletedAt,
        })
        .from(checkpointDiscussions)
        .innerJoin(users, eq(checkpointDiscussions.userId, users.id))
        .where(
          and(
            eq(checkpointDiscussions.checkpointId, checkpointId),
            or(
              and(
                isNull(checkpointDiscussions.parentMessageId),
                isNull(checkpointDiscussions.deletedAt),
              ),
              isNotNull(checkpointDiscussions.parentMessageId),
            ),
          ),
        )
        .orderBy(asc(checkpointDiscussions.createdAt))
        .limit(limit)
        .offset((page - 1) * limit),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(checkpointDiscussions)
        .where(
          and(
            eq(checkpointDiscussions.checkpointId, checkpointId),
            or(
              and(
                isNull(checkpointDiscussions.parentMessageId),
                isNull(checkpointDiscussions.deletedAt),
              ),
              isNotNull(checkpointDiscussions.parentMessageId),
            ),
          ),
        ),
    ]);

    return { messages: messageList, total: Number(count) };
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'listDiscussionMessagesHandler',
    });
  }
}

export async function postDiscussionMessageHandler({ data }: { data: PostDiscussionMessageInput }) {
  throw new Error('postDiscussionMessageHandler not implemented');
}

export async function deleteOwnMessageHandler({ data }: { data: DeleteOwnMessageInput }) {
  throw new Error('deleteOwnMessageHandler not implemented');
}
