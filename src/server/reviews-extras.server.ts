// Server-only handlers for review auxiliary operations
import { eq, and, desc, isNull } from 'drizzle-orm';
import { getDb } from '../db/index';
import { assignments, checkpoints } from '../db/schema/assignments';
import { submissions, reviews } from '../db/schema/submissions';
import { users } from '../db/schema/users';
import { getSessionFromHeaders } from './auth';
import { verifyCheckpointAccess } from './ownership';
import { serverError, ErrorCode } from '../lib/errors';
import { translateKey } from '../lib/i18n-server';
import type { NonNullableSession } from '../lib/types';
import type { z } from 'zod';
import type { OpenForReviewSchema, GetLatestReviewSchema } from './reviews';

type OpenForReviewInput = z.infer<typeof OpenForReviewSchema>;
type GetLatestReviewInput = z.infer<typeof GetLatestReviewSchema>;

function isInstructor(session: NonNullableSession | null): session is NonNullableSession {
  return !!session && session.user.role === 'instructor';
}

function isStudent(session: NonNullableSession | null): session is NonNullableSession {
  return !!session && session.user.role === 'student';
}

export async function openForReviewHandler(args: { data: OpenForReviewInput }) {
  const session = await getSessionFromHeaders();
  if (!isInstructor(session)) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const { submissionId } = args.data;
  const db = getDb();

  try {
    return await db.transaction(async (tx) => {
      // 1. Verify submission exists, get its checkpoint and assignment
      const [submission] = await tx
        .select({
          checkpointId: checkpoints.id,
          checkpointState: checkpoints.state,
          assignmentId: assignments.id,
          instructorId: assignments.instructorId,
        })
        .from(submissions)
        .innerJoin(checkpoints, eq(submissions.checkpointId, checkpoints.id))
        .innerJoin(assignments, eq(checkpoints.assignmentId, assignments.id))
        .where(
          and(
            eq(submissions.id, submissionId),
            eq(assignments.instructorId, session.user.id),
            isNull(assignments.deletedAt),
          ),
        )
        .limit(1)
        .for('update', { of: checkpoints });

      if (!submission) {
        return serverError(ErrorCode.NOT_FOUND, 'Submission not found');
      }

      // 2. Validates checkpoint is in submitted state
      if (submission.checkpointState !== 'submitted') {
        const locale = (session.user.locale || 'en') as 'en' | 'id';
        const message = translateKey('instructorReviews.errors.notInSubmittedState', locale);
        return serverError(ErrorCode.BAD_REQUEST, message);
      }

      // 3. Transition to under_review
      await tx
        .update(checkpoints)
        .set({ state: 'under_review', updatedAt: new Date() })
        .where(eq(checkpoints.id, submission.checkpointId));

      return { success: true };
    });
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'openForReviewHandler',
    });
  }
}

/**
 * Get the most recent review for a checkpoint.
 * Used by the student submission page to display review results.
 */
export async function getLatestReviewHandler(args: { data: GetLatestReviewInput }) {
  const session = await getSessionFromHeaders();
  if (!isStudent(session) && !isInstructor(session)) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const { checkpointId } = args.data;
  const db = getDb();

  try {
    // Ownership check: verify the checkpoint belongs to this user
    const accessError = await verifyCheckpointAccess(db, checkpointId, session);
    if (accessError) return accessError;

    // Fetch the most recent review for the checkpoint's latest submission
    const [latestReview] = await db
      .select({
        id: reviews.id,
        decision: reviews.decision,
        comment: reviews.comment,
        instructorName: users.name,
        createdAt: reviews.createdAt,
        feedbackFileKey: reviews.feedbackFileKey,
        revisionDeadline: reviews.revisionDeadline,
      })
      .from(reviews)
      .innerJoin(submissions, eq(reviews.submissionId, submissions.id))
      .innerJoin(users, eq(reviews.instructorId, users.id))
      .where(eq(submissions.checkpointId, checkpointId))
      .orderBy(desc(reviews.createdAt))
      .limit(1);

    return { review: latestReview ?? null };
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'getLatestReviewHandler',
    });
  }
}
