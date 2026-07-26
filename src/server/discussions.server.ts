// Server-only handlers (not imported by client code)
import { eq, and, asc, isNull, isNotNull, or, sql } from 'drizzle-orm';
import { getDb } from '../db/index';
import { checkpointDiscussions } from '../db/schema/discussions';
import { users } from '../db/schema/users';
import { checkpoints, assignments } from '../db/schema/assignments';
import { getSessionFromHeaders } from './auth';
import { verifyCheckpointAccess } from './ownership';
import { getNotificationKeys } from './notifications.server';
import { maybeInsertNotification } from '../lib/notification-prefs';
import { sendDiscussionReplyEmail } from '../lib/discussion-email';
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
  const session = await getSessionFromHeaders();
  if (!isStudentOrInstructor(session)) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const { checkpointId, message, parentMessageId } = data;
  const db = getDb();

  try {
    // 1. Verify checkpoint ownership
    const accessError = await verifyCheckpointAccess(db, checkpointId, session);
    if (accessError) return accessError;

    // 2. Fetch checkpoint details (assignmentId, studentId, name)
    const [checkpoint] = await db
      .select({
        assignmentId: checkpoints.assignmentId,
        studentId: checkpoints.studentId,
        name: checkpoints.name,
      })
      .from(checkpoints)
      .where(eq(checkpoints.id, checkpointId))
      .limit(1);

    if (!checkpoint) {
      return serverError(ErrorCode.NOT_FOUND, 'Checkpoint not found');
    }

    // 3. Validate parentMessageId belongs to same checkpoint (if provided)
    if (parentMessageId !== undefined) {
      const [parent] = await db
        .select({ id: checkpointDiscussions.id })
        .from(checkpointDiscussions)
        .where(
          and(
            eq(checkpointDiscussions.id, parentMessageId),
            eq(checkpointDiscussions.checkpointId, checkpointId),
          ),
        )
        .limit(1);

      if (!parent) {
        return serverError(ErrorCode.NOT_FOUND, 'Parent message not found');
      }
    }

    // 4. Fetch assignment details (instructorId, title)
    const [assignment] = await db
      .select({ instructorId: assignments.instructorId, title: assignments.title })
      .from(assignments)
      .where(eq(assignments.id, checkpoint.assignmentId))
      .limit(1);

    if (!assignment) {
      return serverError(ErrorCode.NOT_FOUND, 'Assignment not found');
    }

    // 5. Determine notification recipient
    const isStudentPoster = session.user.role === 'student';
    const recipientId = isStudentPoster ? assignment.instructorId : checkpoint.studentId;

    // 6. Insert message + notification in transaction
    const txResult = await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(checkpointDiscussions)
        .values({
          checkpointId,
          assignmentId: checkpoint.assignmentId,
          userId: session.user.id,
          message,
          parentMessageId: parentMessageId ?? null,
        })
        .returning();

      // Fire notification to the other party (skip self-reply)
      if (recipientId !== session.user.id) {
        const notifKeys = getNotificationKeys('discussion_reply');
        await maybeInsertNotification(tx, recipientId, 'discussion_reply', {
          userId: recipientId,
          type: 'discussion_reply',
          titleKey: notifKeys.titleKey,
          messageKey: notifKeys.messageKey,
          params: {
            authorName: session.user.name,
            checkpointName: checkpoint.name,
            assignmentTitle: assignment.title,
            messagePreview: message.slice(0, 100),
          },
          channel: 'in_app',
          metadata: {
            checkpointId,
            assignmentId: checkpoint.assignmentId,
            target: isStudentPoster ? 'instructor' : 'student',
          },
        });
      }

      return { inserted };
    });

    // 7. Post-commit email (advisory — never surfaces error to user)
    if (recipientId !== session.user.id) {
      try {
        await sendDiscussionReplyEmail({
          recipientId,
          authorName: session.user.name,
          checkpointName: checkpoint.name,
          assignmentTitle: assignment.title,
          messagePreview: message.slice(0, 100),
          assignmentId: checkpoint.assignmentId,
          checkpointId,
          target: isStudentPoster ? 'instructor' : 'student',
        });
      } catch (emailErr) {
        console.error('Discussion reply email failed after successful transaction:', emailErr);
      }
    }

    return { success: true, message: txResult.inserted };
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'postDiscussionMessageHandler',
    });
  }
}

const DELETION_WINDOW_MS = 15 * 60 * 1000;

export async function deleteOwnMessageHandler({ data }: { data: DeleteOwnMessageInput }) {
  const session = await getSessionFromHeaders();
  if (!isStudentOrInstructor(session)) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const { messageId } = data;
  const db = getDb();

  try {
    // 1. Fetch message (only non-deleted)
    const [message] = await db
      .select({
        userId: checkpointDiscussions.userId,
        createdAt: checkpointDiscussions.createdAt,
      })
      .from(checkpointDiscussions)
      .where(and(eq(checkpointDiscussions.id, messageId), isNull(checkpointDiscussions.deletedAt)))
      .limit(1);

    if (!message) {
      return serverError(ErrorCode.NOT_FOUND, 'Message not found');
    }

    // 2. Verify author
    if (message.userId !== session.user.id) {
      return serverError(ErrorCode.FORBIDDEN, 'You can only delete your own messages');
    }

    // 3. Check 15-minute deletion window
    if (!message.createdAt || Date.now() - message.createdAt.getTime() > DELETION_WINDOW_MS) {
      return serverError(ErrorCode.FORBIDDEN, 'Deletion window expired');
    }

    // 4. Soft-delete (replies are preserved — list handler excludes only deleted top-level messages)
    await db
      .update(checkpointDiscussions)
      .set({ deletedAt: new Date() })
      .where(eq(checkpointDiscussions.id, messageId));

    return { success: true };
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'deleteOwnMessageHandler',
    });
  }
}
