// Server-only handlers for review operations
import { eq, and, desc, sql, inArray, isNull } from 'drizzle-orm';
import { getDb } from '../db/index';
import { assignments, checkpoints } from '../db/schema/assignments';
import { submissions, reviews } from '../db/schema/submissions';

import { users } from '../db/schema/users';
import { notifications } from '../db/schema/notifications';
import { getSessionFromHeaders } from './auth';
import { logAuditEvent } from '../lib/audit';
import { serverError, ErrorCode } from '../lib/errors';
import { generatePresignedDownloadUrl } from '../lib/storage';
import { calculateBreachDuration } from '../lib/sla';
import {
  adjustDeadlinesForBreach,
  dispatchSLABreachNotifications,
  type SLASubmissionFields,
} from '../lib/review-sla';
import { getNotificationKeys, resolveNotificationContent } from './notifications.server';
import type { NonNullableSession } from '../lib/types';
import type { z } from 'zod';
import type {
  ListPendingReviewsSchema,
  GetReviewDetailSchema,
  SubmitReviewSchema,
} from './reviews';

type ListPendingReviewsInput = z.infer<typeof ListPendingReviewsSchema>;
type GetReviewDetailInput = z.infer<typeof GetReviewDetailSchema>;
type SubmitReviewInput = z.infer<typeof SubmitReviewSchema>;

function isInstructor(session: NonNullableSession | null): session is NonNullableSession {
  return !!session && session.user.role === 'instructor';
}

const REVIEWABLE_STATES = ['submitted', 'under_review'] as const;

/**
 * List pending submissions across all instructor's assignments.
 * Uses DISTINCT ON to get the latest submission per checkpoint.
 * Returns FIFO order (oldest pending submission first).
 */
export async function listPendingReviewsHandler(args: { data: ListPendingReviewsInput }) {
  const session = await getSessionFromHeaders();
  if (!isInstructor(session)) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const { page, limit, assignmentId } = args.data;
  const db = getDb();

  try {
    // 1. Get instructor's assignment IDs
    const assignmentConditions = [
      eq(assignments.instructorId, session.user.id),
      isNull(assignments.deletedAt),
    ];
    if (assignmentId) {
      assignmentConditions.push(eq(assignments.id, assignmentId));
    }

    const instructorAssignments = await db
      .select({ id: assignments.id })
      .from(assignments)
      .where(and(...assignmentConditions));

    if (instructorAssignments.length === 0) {
      return { items: [], total: 0 };
    }

    const assignmentIds = instructorAssignments.map((a) => a.id);

    // 2. Get total count of pending checkpoints (submitted or under_review state)
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(checkpoints)
      .where(
        and(
          inArray(checkpoints.assignmentId, assignmentIds),
          sql`${checkpoints.state} IN ('submitted', 'under_review')`,
        ),
      );

    // 3. Fetch pending submissions with DISTINCT ON to get latest per checkpoint
    const pendingItems = await db
      .select({
        submissionId: submissions.id,
        checkpointId: checkpoints.id,
        checkpointName: checkpoints.name,
        assignmentId: assignments.id,
        assignmentTitle: assignments.title,
        studentId: checkpoints.studentId,
        studentName: users.name,
        fileName: submissions.fileName,
        fileSize: submissions.fileSize,
        fileKey: submissions.fileKey,
        version: submissions.version,
        uploadedAt: submissions.uploadedAt,
        checkpointState: checkpoints.state,
        checkpointUpdatedAt: checkpoints.updatedAt,
      })
      .from(submissions)
      .innerJoin(checkpoints, eq(submissions.checkpointId, checkpoints.id))
      .innerJoin(assignments, eq(checkpoints.assignmentId, assignments.id))
      .innerJoin(users, eq(checkpoints.studentId, users.id))
      .where(
        and(
          sql`${submissions.id} IN (
            SELECT DISTINCT ON (s2.checkpoint_id) s2.id
            FROM submissions s2
            WHERE s2.checkpoint_id = ${submissions.checkpointId}
            ORDER BY s2.checkpoint_id, s2.version DESC
          )`,
          inArray(checkpoints.assignmentId, assignmentIds),
          sql`${checkpoints.state} IN ('submitted', 'under_review')`,
        ),
      )
      .orderBy(sql`${submissions.uploadedAt} ASC`)
      .limit(limit)
      .offset((page - 1) * limit);

    return {
      items: pendingItems,
      total: Number(count),
    };
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'listPendingReviewsHandler',
    });
  }
}

/**
 * Get review detail for a specific submission.
 * Pure GET — does NOT mutate state.
 * Returns submission info, presigned download URL, and past review history.
 */
export async function getReviewDetailHandler(args: { data: GetReviewDetailInput }) {
  const session = await getSessionFromHeaders();
  if (!isInstructor(session)) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const { submissionId } = args.data;
  const db = getDb();

  try {
    // 1. Fetch submission with checkpoint, assignment, and user info
    const [submission] = await db
      .select({
        submissionId: submissions.id,
        checkpointId: checkpoints.id,
        checkpointName: checkpoints.name,
        assignmentId: assignments.id,
        assignmentTitle: assignments.title,
        instructorId: assignments.instructorId,
        studentId: checkpoints.studentId,
        studentName: users.name,
        fileKey: submissions.fileKey,
        fileName: submissions.fileName,
        fileSize: submissions.fileSize,
        version: submissions.version,
        uploadedAt: submissions.uploadedAt,
        checkpointState: checkpoints.state,
        checkpointUpdatedAt: checkpoints.updatedAt,
      })
      .from(submissions)
      .innerJoin(checkpoints, eq(submissions.checkpointId, checkpoints.id))
      .innerJoin(assignments, eq(checkpoints.assignmentId, assignments.id))
      .innerJoin(users, eq(checkpoints.studentId, users.id))
      .where(
        and(
          eq(submissions.id, submissionId),
          eq(assignments.instructorId, session.user.id),
          isNull(assignments.deletedAt),
        ),
      )
      .limit(1);

    if (!submission) {
      return serverError(ErrorCode.NOT_FOUND, 'Submission not found');
    }

    // 2. Generate presigned download URL
    const downloadUrl = await generatePresignedDownloadUrl({ key: submission.fileKey });

    // 3. Fetch past review history for this checkpoint
    const reviewHistory = await db
      .select({
        id: reviews.id,
        decision: reviews.decision,
        comment: reviews.comment,
        instructorName: users.name,
        createdAt: reviews.createdAt,
      })
      .from(reviews)
      .innerJoin(submissions, eq(reviews.submissionId, submissions.id))
      .innerJoin(users, eq(reviews.instructorId, users.id))
      .where(eq(submissions.checkpointId, submission.checkpointId))
      .orderBy(desc(reviews.createdAt));

    return {
      submission: {
        ...submission,
        downloadUrl,
      },
      reviewHistory,
    };
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'getReviewDetailHandler',
    });
  }
}

/**
 * Open a submission for review.
 * POST action — transitions checkpoint from submitted to under_review.
 * Called explicitly by the client after loading review detail page.
 */
/**
 * Submit a review decision (pass/revise) for a submission.
 * Validates ownership, state, and handles checkpoint transitions.
 */
export async function submitReviewHandler(args: { data: SubmitReviewInput }) {
  const session = await getSessionFromHeaders();
  if (!isInstructor(session)) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const { submissionId, decision, comment, feedbackFileKey, revisionDeadline } = args.data;
  const db = getDb();

  try {
    // 1. Verify ownership — submission belongs to an assignment owned by this instructor
    const [submission] = await db
      .select({
        checkpointId: checkpoints.id,
        checkpointState: checkpoints.state,
        checkpointName: checkpoints.name,
        assignmentId: assignments.id,
        assignmentTitle: assignments.title,
        instructorId: assignments.instructorId,
        studentId: checkpoints.studentId,
        studentName: users.name,
        checkpointUpdatedAt: checkpoints.updatedAt,
        checkpointDueDate: checkpoints.dueDate,
        checkpointOrder: checkpoints.order,
        finalDeadline: assignments.finalDeadline,
      })
      .from(submissions)
      .innerJoin(checkpoints, eq(submissions.checkpointId, checkpoints.id))
      .innerJoin(assignments, eq(checkpoints.assignmentId, assignments.id))
      .innerJoin(users, eq(checkpoints.studentId, users.id))
      .where(
        and(
          eq(submissions.id, submissionId),
          eq(assignments.instructorId, session.user.id),
          isNull(assignments.deletedAt),
        ),
      )
      .limit(1);

    if (!submission) {
      return serverError(ErrorCode.NOT_FOUND, 'Submission not found');
    }

    // 2. Validate checkpoint is in reviewable state
    if (
      !REVIEWABLE_STATES.includes(submission.checkpointState as (typeof REVIEWABLE_STATES)[number])
    ) {
      return serverError(ErrorCode.BAD_REQUEST, 'Checkpoint is not in a reviewable state');
    }

    // 3. If revise, revision deadline is required
    if (decision === 'revise' && !revisionDeadline) {
      return serverError(
        ErrorCode.BAD_REQUEST,
        'Revision deadline is required for revise decision',
      );
    }

    // 4. Execute in transaction
    let breachDays = 0;
    const slaFields: SLASubmissionFields = {
      checkpointId: submission.checkpointId,
      checkpointDueDate: submission.checkpointDueDate,
      checkpointName: submission.checkpointName ?? '',
      checkpointOrder: submission.checkpointOrder,
      assignmentId: submission.assignmentId,
      assignmentTitle: submission.assignmentTitle ?? '',
      studentId: submission.studentId,
      studentName: submission.studentName ?? '',
      finalDeadline: submission.finalDeadline,
    };

    await db.transaction(async (tx) => {
      // 4a. Insert review record
      await tx.insert(reviews).values({
        submissionId,
        instructorId: session.user.id,
        decision,
        comment: comment || null,
        feedbackFileKey: feedbackFileKey || null,
        revisionDeadline:
          decision === 'revise' && revisionDeadline ? new Date(revisionDeadline) : null,
        reviewedAt: new Date(),
      });

      if (decision === 'pass') {
        // 4b. Set checkpoint to passed
        await tx
          .update(checkpoints)
          .set({ state: 'passed', updatedAt: new Date() })
          .where(eq(checkpoints.id, submission.checkpointId));

        // 4c. Unlock next sequential checkpoint
        // (minConsultations gates SUBMISSION, not unlock — enforced in
        //  submitCheckpointHandler, not here)
        const nextCheckpoint = await tx
          .select({ id: checkpoints.id })
          .from(checkpoints)
          .where(
            and(
              eq(checkpoints.assignmentId, submission.assignmentId),
              eq(checkpoints.studentId, submission.studentId),
              eq(checkpoints.state, 'locked'),
            ),
          )
          .orderBy(checkpoints.order)
          .limit(1);

        if (nextCheckpoint.length > 0) {
          await tx
            .update(checkpoints)
            .set({ state: 'unlocked', updatedAt: new Date() })
            .where(eq(checkpoints.id, nextCheckpoint[0].id));
        }
      } else if (decision === 'revise') {
        // 4d. Set checkpoint to revise
        await tx
          .update(checkpoints)
          .set({ state: 'revise', updatedAt: new Date() })
          .where(eq(checkpoints.id, submission.checkpointId));
      }

      // 4e. SLA breach detection & deadline adjustment
      // SLA clock starts at the under_review transition (TDD §6 Review SLA).
      // If the instructor reviews directly from 'submitted' state (openForReview
      // not called), the SLA clock starts now — no breach counted, no false
      // deadline extension for the student.
      const underReviewAt =
        submission.checkpointState === 'under_review' ? submission.checkpointUpdatedAt : new Date();
      breachDays = calculateBreachDuration(underReviewAt ?? new Date(), new Date());

      if (breachDays > 0) {
        await adjustDeadlinesForBreach(tx, slaFields, breachDays);
      }

      // 4f. Create notification for the student (review_completed or revision_requested)
      const reviewParams = {
        checkpointName: submission.checkpointName,
        assignmentTitle: submission.assignmentTitle,
      };

      if (decision === 'pass') {
        const reviewCompletedKeys = getNotificationKeys('review_completed');
        const reviewCompletedFallback = resolveNotificationContent(
          reviewCompletedKeys.titleKey,
          reviewCompletedKeys.messageKey,
          reviewParams,
          'en',
        );
        await tx.insert(notifications).values({
          userId: submission.studentId,
          type: 'review_completed',
          title: reviewCompletedFallback.title,
          message: reviewCompletedFallback.message,
          titleKey: reviewCompletedKeys.titleKey,
          messageKey: reviewCompletedKeys.messageKey,
          params: reviewParams,
          channel: 'in_app',
          metadata: {
            checkpointId: submission.checkpointId,
            assignmentId: submission.assignmentId,
            submissionId,
            decision,
          },
        });
      } else if (decision === 'revise') {
        const revisionRequestedKeys = getNotificationKeys('revision_requested');
        const revisionRequestedFallback = resolveNotificationContent(
          revisionRequestedKeys.titleKey,
          revisionRequestedKeys.messageKey,
          reviewParams,
          'en',
        );
        await tx.insert(notifications).values({
          userId: submission.studentId,
          type: 'revision_requested',
          title: revisionRequestedFallback.title,
          message: revisionRequestedFallback.message,
          titleKey: revisionRequestedKeys.titleKey,
          messageKey: revisionRequestedKeys.messageKey,
          params: reviewParams,
          channel: 'in_app',
          metadata: {
            checkpointId: submission.checkpointId,
            assignmentId: submission.assignmentId,
            submissionId,
            decision,
          },
        });
      }
    });

    // 4g. Audit logging (post-commit advisory — must not fail the request)
    try {
      await logAuditEvent({
        actorId: session.user.id,
        action: decision === 'pass' ? 'review.passed' : 'review.revised',
        entityType: 'review',
        entityId: String(submissionId),
        details:
          decision === 'pass'
            ? { checkpointName: submission.checkpointName, comment: comment || null }
            : { checkpointName: submission.checkpointName, revisionDeadline },
      });
    } catch (advisoryErr) {
      console.error('Post-commit advisory work failed in submitReviewHandler:', advisoryErr);
    }

    // 4f. SLA breach notifications (after transaction — advisory, non-critical)
    if (breachDays > 0) {
      try {
        await dispatchSLABreachNotifications(db, slaFields, breachDays);
      } catch (advisoryErr) {
        console.error('Post-commit advisory work failed in submitReviewHandler:', advisoryErr);
      }
    }

    return { success: true };
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'submitReviewHandler',
    });
  }
}

/**
 * Get the most recent review for a checkpoint.
 * Used by the student submission page to display review results.
 */
export { openForReviewHandler, getLatestReviewHandler } from './reviews-extras.server';
