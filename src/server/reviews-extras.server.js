// Server-only handlers for review auxiliary operations
import { eq, and, desc, isNull } from 'drizzle-orm';
import { getDb } from '../db/index';
import { assignments, checkpoints } from '../db/schema/assignments';
import { submissions, reviews } from '../db/schema/submissions';
import { users } from '../db/schema/users';
import { getSessionFromHeaders } from './auth';
import { verifyCheckpointAccess } from './ownership';
function isInstructor(session) {
  return !!session && session.user.role === 'instructor';
}
function isStudent(session) {
  return !!session && session.user.role === 'student';
}
export async function openForReviewHandler(args) {
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
 * Get the most recent review for a checkpoint.
 * Used by the student submission page to display review results.
 */
export async function getLatestReviewHandler(args) {
  const session = await getSessionFromHeaders();
  if (!isStudent(session) && !isInstructor(session)) {
    return { error: 'Unauthorized' };
  }
  const { checkpointId } = args.data;
  const db = getDb();
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
}
