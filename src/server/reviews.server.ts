// Server-only handlers for review operations
import { eq, and, desc, sql, inArray, isNull } from 'drizzle-orm';
import { getDb } from '../db/index';
import { assignments, checkpoints } from '../db/schema/assignments';
import { submissions, reviews } from '../db/schema/submissions';
import { consultations } from '../db/schema/consultations';
import { users } from '../db/schema/users';
import { getSessionFromHeaders } from './auth';
import { generatePresignedDownloadUrl } from '../lib/storage';
import { calculateBreachDuration } from '../lib/sla';
import {
  adjustDeadlinesForBreach,
  dispatchSLABreachNotifications,
  type SLASubmissionFields,
} from '../lib/review-sla';
import type { z } from 'zod';
import type {
  ListPendingReviewsSchema,
  GetReviewDetailSchema,
  OpenForReviewSchema,
  SubmitReviewSchema,
  GetLatestReviewSchema,
} from './reviews';

type ListPendingReviewsInput = z.infer<typeof ListPendingReviewsSchema>;
type GetReviewDetailInput = z.infer<typeof GetReviewDetailSchema>;
type OpenForReviewInput = z.infer<typeof OpenForReviewSchema>;
type SubmitReviewInput = z.infer<typeof SubmitReviewSchema>;
type GetLatestReviewInput = z.infer<typeof GetLatestReviewSchema>;

function isInstructor(
  session: any,
): session is { user: { id: string; role: string }; session: any } {
  return !!session && session.user.role === 'instructor';
}

function isStudent(session: any): session is { user: { id: string; role: string }; session: any } {
  return !!session && session.user.role === 'student';
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
    return { error: 'Unauthorized' };
  }

  const { page, limit, assignmentId } = args.data;
  const db = getDb();

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
}

/**
 * Get review detail for a specific submission.
 * Pure GET — does NOT mutate state.
 * Returns submission info, presigned download URL, and past review history.
 */
export async function getReviewDetailHandler(args: { data: GetReviewDetailInput }) {
  const session = await getSessionFromHeaders();
  if (!isInstructor(session)) {
    return { error: 'Unauthorized' };
  }

  const { submissionId } = args.data;
  const db = getDb();

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
    return { error: 'Submission not found' };
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
}

/**
 * Open a submission for review.
 * POST action — transitions checkpoint from submitted to under_review.
 * Called explicitly by the client after loading review detail page.
 */
export async function openForReviewHandler(args: { data: OpenForReviewInput }) {
  const session = await getSessionFromHeaders();
  if (!isInstructor(session)) {
    return { error: 'Unauthorized' };
  }

  const { submissionId } = args.data;
  const db = getDb();

  // 1. Verify submission exists, get its checkpoint and assignment
  const [submission] = await db
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
    .limit(1);

  if (!submission) {
    return { error: 'Submission not found' };
  }

  // 2. Validates checkpoint is in submitted state
  if (submission.checkpointState !== 'submitted') {
    return { error: 'Checkpoint is not in submittable state' };
  }

  // 3. Transition to under_review
  await db
    .update(checkpoints)
    .set({ state: 'under_review', updatedAt: new Date() })
    .where(eq(checkpoints.id, submission.checkpointId));

  return { success: true };
}

/**
 * Submit a review decision (pass/revise) for a submission.
 * Validates ownership, state, and handles checkpoint transitions.
 */
export async function submitReviewHandler(args: { data: SubmitReviewInput }) {
  const session = await getSessionFromHeaders();
  if (!isInstructor(session)) {
    return { error: 'Unauthorized' };
  }

  const { submissionId, decision, comment, feedbackFileKey, revisionDeadline } = args.data;
  const db = getDb();

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
    .innerJoin(users, eq(checkpoints.studentId, users.id))
    .innerJoin(checkpoints, eq(submissions.checkpointId, checkpoints.id))
    .innerJoin(assignments, eq(checkpoints.assignmentId, assignments.id))
    .where(
      and(
        eq(submissions.id, submissionId),
        eq(assignments.instructorId, session.user.id),
        isNull(assignments.deletedAt),
      ),
    )
    .limit(1);

  if (!submission) {
    return { error: 'Submission not found' };
  }

  // 2. Validate checkpoint is in reviewable state
  if (
    !REVIEWABLE_STATES.includes(submission.checkpointState as (typeof REVIEWABLE_STATES)[number])
  ) {
    return { error: 'Checkpoint is not in a reviewable state' };
  }

  // 3. If revise, revision deadline is required
  if (decision === 'revise' && !revisionDeadline) {
    return { error: 'Revision deadline is required for revise decision' };
  }

  // 4. Execute in transaction
  let breachDays = 0;
  try {
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

        // 4c. Unlock the next sequential checkpoint for this student (with consultation gating)
        const nextCheckpoint = await tx
          .select({
            id: checkpoints.id,
            minConsultations: checkpoints.minConsultations,
          })
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
          const minConsults = nextCheckpoint[0].minConsultations ?? 0;
          if (minConsults > 0) {
            // Check if student has enough verified consultations for this checkpoint
            const [{ count }] = await tx
              .select({ count: sql<number>`count(*)::int` })
              .from(consultations)
              .where(
                and(
                  eq(consultations.checkpointId, nextCheckpoint[0].id),
                  eq(consultations.studentId, submission.studentId),
                  eq(consultations.status, 'verified'),
                ),
              );

            if (Number(count) < minConsults) {
              // Keep locked — consultation requirements not met
              // The blocking reason is already handled in getStudentAssignmentDetailHandler
              return;
            }
          }

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
      breachDays = calculateBreachDuration(
        submission.checkpointUpdatedAt ?? new Date(),
        new Date(),
      );

      if (breachDays > 0) {
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
        await adjustDeadlinesForBreach(tx, slaFields, breachDays);
      }
    });

    // 4f. SLA breach notifications (after transaction — advisory, non-critical)
    if (breachDays > 0) {
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
      await dispatchSLABreachNotifications(db, slaFields, breachDays);
    }

    return { success: true };
  } catch (err) {
    console.error('Failed to submit review:', err);
    return { error: 'Internal Server Error' };
  }
}

/**
 * Get the most recent review for a checkpoint.
 * Used by the student submission page to display review results.
 */
export async function getLatestReviewHandler(args: { data: GetLatestReviewInput }) {
  const session = await getSessionFromHeaders();
  if (!isStudent(session) && !isInstructor(session)) {
    return { error: 'Unauthorized' };
  }

  const { checkpointId } = args.data;
  const db = getDb();

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
}
