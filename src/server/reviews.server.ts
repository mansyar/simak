// Server-only handlers for review operations
import { eq, and, desc, sql, inArray, isNull, gt } from 'drizzle-orm';
import { getDb } from '../db/index';
import { assignments, checkpoints } from '../db/schema/assignments';
import { submissions, reviews, uploadIntents } from '../db/schema/submissions';
import { users } from '../db/schema/users';
import { getSessionFromHeaders } from './auth';
import { logAuditEvent } from '../lib/audit';
import { serverError, ErrorCode, isServerError } from '../lib/errors';
import { generatePresignedDownloadUrl, getObjectContentLength, r2SizeError } from '../lib/storage';
import { MAX_FILE_SIZE } from '../lib/file-validation';
import { calculateBreachDuration } from '../lib/sla';
import {
  adjustDeadlinesForBreach,
  dispatchSLABreachNotifications,
  type SLASubmissionFields,
} from '../lib/review-sla';
import { getNotificationKeys } from './notifications.server';
import { sendReviewEmail } from '../lib/review-email';
import { maybeInsertNotification } from '../lib/notification-prefs';
import { fetchRubric } from './rubrics.server';
import { validateReviewScores, insertReviewScores } from './review-scores.server';
import { advisoryRecomputeGrade } from './reviews-extras.server';
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
 * Uses LATERAL join to get the latest submission per checkpoint.
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

    // 3. Fetch pending submissions with LATERAL join to get latest per checkpoint
    const pendingItems = await db
      .select({
        submissionId: sql<number>`latest_submission.id`,
        checkpointId: checkpoints.id,
        checkpointName: checkpoints.name,
        assignmentId: assignments.id,
        assignmentTitle: assignments.title,
        studentId: checkpoints.studentId,
        studentName: users.name,
        fileName: sql<string>`latest_submission.file_name`,
        fileSize: sql<number>`latest_submission.file_size`,
        fileKey: sql<string>`latest_submission.file_key`,
        version: sql<number | null>`latest_submission.version`,
        uploadedAt: sql<Date | null>`latest_submission.uploaded_at`,
        checkpointState: checkpoints.state,
        checkpointUpdatedAt: checkpoints.updatedAt,
      })
      .from(checkpoints)
      .innerJoin(
        sql`LATERAL (SELECT * FROM ${submissions} WHERE ${submissions.checkpointId} = ${checkpoints.id} ORDER BY ${submissions.version} DESC LIMIT 1) AS latest_submission`,
        sql`true`,
      )
      .innerJoin(assignments, eq(checkpoints.assignmentId, assignments.id))
      .innerJoin(users, eq(checkpoints.studentId, users.id))
      .where(
        and(
          inArray(checkpoints.assignmentId, assignmentIds),
          sql`${checkpoints.state} IN ('submitted', 'under_review')`,
        ),
      )
      .orderBy(sql`latest_submission.uploaded_at ASC`)
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
        templateCheckpointId: checkpoints.templateCheckpointId,
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

    const rubric = submission.templateCheckpointId
      ? await fetchRubric(db, submission.templateCheckpointId)
      : null;
    return { submission: { ...submission, downloadUrl }, reviewHistory, rubric };
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'getReviewDetailHandler',
    });
  }
}

/**
 * Submit a review decision (pass/revise) for a submission.
 * Validates ownership, state, and handles checkpoint transitions.
 */
export async function submitReviewHandler(args: { data: SubmitReviewInput }) {
  const session = await getSessionFromHeaders();
  if (!isInstructor(session)) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const { submissionId, decision, comment, feedbackFileKey, revisionDeadline, scores } = args.data;
  const db = getDb();

  try {
    // 1. If revise, revision deadline is required (input validation only).
    if (decision === 'revise' && !revisionDeadline) {
      return serverError(
        ErrorCode.BAD_REQUEST,
        'Revision deadline is required for revise decision',
      );
    }

    // 1b. R2 HEAD check before transaction to avoid holding DB lock during I/O (BUG-14).
    if (feedbackFileKey) {
      const sizeResult = await getObjectContentLength({ key: feedbackFileKey });
      if (!sizeResult.ok) {
        const locale = (session.user.locale || 'en') as 'en' | 'id';
        return r2SizeError(sizeResult.reason, locale);
      }
      if (sizeResult.size > MAX_FILE_SIZE) {
        return serverError(ErrorCode.BAD_REQUEST, 'File size exceeds 25MB limit');
      }
    }

    // 2. Execute in transaction
    const txResult = await db.transaction(async (tx) => {
      // 2a. Verify ownership — submission belongs to an assignment owned by this instructor
      const [submission] = await tx
        .select({
          checkpointId: checkpoints.id,
          checkpointState: checkpoints.state,
          checkpointName: checkpoints.name,
          assignmentId: assignments.id,
          assignmentTitle: assignments.title,
          instructorId: assignments.instructorId,
          studentId: checkpoints.studentId,
          studentName: users.name,
          uploadedAt: submissions.uploadedAt,
          checkpointUpdatedAt: checkpoints.updatedAt,
          checkpointDueDate: checkpoints.dueDate,
          checkpointOrder: checkpoints.order,
          finalDeadline: assignments.finalDeadline,
          templateCheckpointId: checkpoints.templateCheckpointId,
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
        .limit(1)
        .for('update', { of: checkpoints });

      if (!submission) {
        return serverError(ErrorCode.NOT_FOUND, 'Submission not found');
      }

      // 2b. Validate checkpoint is in reviewable state (post-lock).
      if (
        !REVIEWABLE_STATES.includes(
          submission.checkpointState as (typeof REVIEWABLE_STATES)[number],
        )
      ) {
        return serverError(ErrorCode.BAD_REQUEST, 'Checkpoint is not in a reviewable state');
      }

      // 2c. Validate rubric scores BEFORE any write (SQL styleguide §6:
      // a validation failure must not commit partial writes). The rubric read
      // is inside the transaction for stability.
      const scoresError = await validateReviewScores(tx, submission.templateCheckpointId, scores);
      if (scoresError) return scoresError;

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

      // 2c. Verify and consume upload intent for review feedback (H1 trust boundary).
      if (feedbackFileKey) {
        const now = new Date();
        const [intent] = await tx
          .select()
          .from(uploadIntents)
          .where(
            and(
              eq(uploadIntents.fileKey, feedbackFileKey),
              eq(uploadIntents.userId, session.user.id),
              eq(uploadIntents.purpose, 'review_feedback'),
              isNull(uploadIntents.checkpointId),
              isNull(uploadIntents.consumedAt),
              gt(uploadIntents.expiresAt, now),
            ),
          )
          .limit(1)
          .for('update');

        if (
          !intent ||
          intent.userId !== session.user.id ||
          intent.purpose !== 'review_feedback' ||
          intent.checkpointId !== null
        ) {
          return serverError(ErrorCode.BAD_REQUEST, 'Invalid or expired upload intent');
        }

        await tx
          .update(uploadIntents)
          .set({ consumedAt: now })
          .where(eq(uploadIntents.fileKey, feedbackFileKey));
      }

      // 2d. Insert review record (capture ID via .returning — SQL styleguide §6.3)
      const [review] = await tx
        .insert(reviews)
        .values({
          submissionId,
          instructorId: session.user.id,
          decision,
          comment: comment || null,
          feedbackFileKey: feedbackFileKey || null,
          revisionDeadline:
            decision === 'revise' && revisionDeadline ? new Date(revisionDeadline) : null,
          reviewedAt: new Date(),
        })
        .returning({ id: reviews.id });

      // 2e. Insert rubric scores (reviewId captured above — no separate SELECT)
      if (submission.templateCheckpointId && scores && scores.length > 0) {
        await insertReviewScores(tx, review.id, submission.templateCheckpointId, scores);
      }

      if (decision === 'pass') {
        // 2e. Set checkpoint to passed
        await tx
          .update(checkpoints)
          .set({ state: 'passed', updatedAt: new Date() })
          .where(eq(checkpoints.id, submission.checkpointId));

        // 2f. Unlock next sequential checkpoint
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
        // 2g. Set checkpoint to revise
        await tx
          .update(checkpoints)
          .set({ state: 'revise', updatedAt: new Date() })
          .where(eq(checkpoints.id, submission.checkpointId));
      }

      // 2h. SLA breach detection & deadline adjustment
      // H2: SLA clock is anchored at submission time. A student waiting since
      // upload earns a deadline extension whenever the instructor reviews late,
      // regardless of whether openForReview was explicitly called first.
      const anchorTime = submission.uploadedAt ?? new Date();
      breachDays = calculateBreachDuration(anchorTime, new Date());

      if (breachDays > 0) {
        await adjustDeadlinesForBreach(tx, slaFields, breachDays);
      }

      // 2i. Create notification for the student (review_completed or revision_requested)
      const notifType = decision === 'pass' ? 'review_completed' : 'revision_requested';
      const notifKeys = getNotificationKeys(notifType);
      await maybeInsertNotification(tx, submission.studentId, notifType, {
        userId: submission.studentId,
        type: notifType,
        titleKey: notifKeys.titleKey,
        messageKey: notifKeys.messageKey,
        params: {
          checkpointName: submission.checkpointName,
          assignmentTitle: submission.assignmentTitle,
        },
        channel: 'in_app',
        metadata: {
          checkpointId: submission.checkpointId,
          assignmentId: submission.assignmentId,
          submissionId,
          decision,
        },
      });

      return { success: true, submission, breachDays, slaFields };
    });

    if (isServerError(txResult)) {
      return txResult;
    }

    const { submission, breachDays, slaFields } = txResult;

    // 3. Audit logging (post-commit advisory — must not fail the request)
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

    // 4. SLA breach notifications (after transaction — advisory, non-critical)
    if (breachDays > 0) {
      try {
        await dispatchSLABreachNotifications(db, slaFields, breachDays);
      } catch (advisoryErr) {
        console.error('Post-commit advisory work failed in submitReviewHandler:', advisoryErr);
      }
    }
    // 5. Email notification (post-commit advisory)
    await sendReviewEmail({
      studentId: submission.studentId,
      decision,
      reviewerName: session.user.name,
      assignmentTitle: submission.assignmentTitle,
      checkpointName: submission.checkpointName,
      assignmentId: submission.assignmentId,
      revisionDeadline,
    });
    await advisoryRecomputeGrade(db, decision, submission);
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
