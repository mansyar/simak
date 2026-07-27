// Server-only handlers for review auxiliary operations
import { eq, and, desc, isNull } from 'drizzle-orm';
import { getDb } from '../db/index';
import { assignments, checkpoints } from '../db/schema/assignments';
import { submissions, reviews } from '../db/schema/submissions';
import { reviewScores } from '../db/schema/rubrics';
import { templateCheckpoints } from '../db/schema/templates';
import { finalGrades } from '../db/schema/gradebook';
import { users } from '../db/schema/users';
import { fetchGradeConfig, groupRowsToCheckpoints } from './gradebook.server';
import { computeFinalGrade } from '../lib/grade-computation';
import type { ScoreRow } from './gradebook.server';
import { getSessionFromHeaders } from './auth';
import { verifyCheckpointAccess } from './ownership';
import { serverError, ErrorCode } from '../lib/errors';
import { translateKey } from '../lib/i18n-server';
import { isInstructor, isStudent } from '../lib/session-guards';
import type { z } from 'zod';
import type { OpenForReviewSchema, GetLatestReviewSchema } from './reviews';

type OpenForReviewInput = z.infer<typeof OpenForReviewSchema>;
type GetLatestReviewInput = z.infer<typeof GetLatestReviewSchema>;

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

    // Fetch review_scores (denormalized snapshot) for the latest review
    const scores = latestReview
      ? await db
          .select({
            id: reviewScores.id,
            criterionId: reviewScores.criterionId,
            criterionTitle: reviewScores.criterionTitle,
            score: reviewScores.score,
            weight: reviewScores.weight,
            rubricLevelId: reviewScores.rubricLevelId,
            levelLabel: reviewScores.levelLabel,
            comment: reviewScores.comment,
          })
          .from(reviewScores)
          .where(eq(reviewScores.reviewId, latestReview.id))
      : [];

    return { review: latestReview ?? null, scores };
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'getLatestReviewHandler',
    });
  }
}

/**
 * Recompute a student's final grade after a review is submitted.
 * Called as a post-commit advisory — wrapped in try/catch by the caller.
 */
export async function recomputeStudentGrade(
  db: ReturnType<typeof getDb>,
  assignmentId: number,
  studentId: string,
): Promise<void> {
  const config = await fetchGradeConfig(db, assignmentId);
  if (!config) return;

  const rows = (await db
    .select({
      checkpointId: checkpoints.id,
      checkpointName: checkpoints.name,
      templateCheckpointId: checkpoints.templateCheckpointId,
      order: checkpoints.order,
      state: checkpoints.state,
      gradingType: templateCheckpoints.gradingType,
      criterionId: reviewScores.criterionId,
      criterionTitle: reviewScores.criterionTitle,
      score: reviewScores.score,
      weight: reviewScores.weight,
      rubricLevelId: reviewScores.rubricLevelId,
      levelLabel: reviewScores.levelLabel,
    })
    .from(checkpoints)
    .leftJoin(templateCheckpoints, eq(templateCheckpoints.id, checkpoints.templateCheckpointId))
    .leftJoin(submissions, eq(submissions.checkpointId, checkpoints.id))
    .leftJoin(reviews, eq(reviews.submissionId, submissions.id))
    .leftJoin(reviewScores, eq(reviewScores.reviewId, reviews.id))
    .where(and(eq(checkpoints.assignmentId, assignmentId), eq(checkpoints.studentId, studentId)))
    .orderBy(checkpoints.order)) as unknown as ScoreRow[];

  const result = computeFinalGrade(groupRowsToCheckpoints(rows), config);
  const numericScore = result.numericScore !== null ? String(result.numericScore) : null;

  await db
    .insert(finalGrades)
    .values({
      assignmentId,
      studentId,
      numericScore,
      letterGrade: result.letterGrade,
      status: result.status,
      contributingCheckpoints: result.contributingCheckpoints,
      computedAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [finalGrades.assignmentId, finalGrades.studentId],
      set: {
        numericScore,
        letterGrade: result.letterGrade,
        status: result.status,
        contributingCheckpoints: result.contributingCheckpoints,
        computedAt: new Date(),
        updatedAt: new Date(),
      },
    });
}

/**
 * Advisory grade recomputation after a review pass decision.
 * Non-blocking — errors are logged but do not fail the request.
 */
export async function advisoryRecomputeGrade(
  db: ReturnType<typeof getDb>,
  decision: string,
  submission: { assignmentId: number; studentId: string },
): Promise<void> {
  if (decision !== 'pass') return;
  try {
    await recomputeStudentGrade(db, submission.assignmentId, submission.studentId);
  } catch (e) {
    console.error('Post-commit advisory work failed in submitReviewHandler:', e);
  }
}
