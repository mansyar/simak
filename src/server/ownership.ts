// Shared ownership verification helpers for server handlers
import { eq, and, isNull } from 'drizzle-orm';
import { assignments, assignmentStudents } from '../db/schema/assignments';
import { checkpoints } from '../db/schema/assignments';
import type { Db } from '../db/index';

type Session = { user: { id: string; role: string } };

/**
 * Verify the user has access to the given assignment.
 * Students must be enrolled via assignmentStudents.
 * Instructors must own the assignment.
 * Returns { error } if denied, or null if authorized.
 */
export async function verifyAssignmentAccess(
  db: Db,
  assignmentId: number,
  session: Session,
): Promise<{ error: string } | null> {
  const role = session.user.role;
  if (role === 'student') {
    const [enrollment] = await db
      .select({ id: assignmentStudents.id })
      .from(assignmentStudents)
      .where(
        and(
          eq(assignmentStudents.assignmentId, assignmentId),
          eq(assignmentStudents.studentId, session.user.id),
        ),
      )
      .limit(1);
    return enrollment ? null : { error: 'Assignment not found' };
  }
  if (role === 'instructor') {
    const [assignment] = await db
      .select({ id: assignments.id })
      .from(assignments)
      .where(
        and(
          eq(assignments.id, assignmentId),
          eq(assignments.instructorId, session.user.id),
          isNull(assignments.deletedAt),
        ),
      )
      .limit(1);
    return assignment ? null : { error: 'Assignment not found' };
  }
  return { error: 'Unauthorized' };
}

/**
 * Verify the user has access to the given checkpoint.
 * Students must own the checkpoint (via assignmentStudents).
 * Instructors must own the parent assignment.
 * Returns { error } if denied, or null if authorized.
 */
export async function verifyCheckpointAccess(
  db: Db,
  checkpointId: number,
  session: Session,
): Promise<{ error: string } | null> {
  const role = session.user.role;
  if (role === 'student') {
    const [owned] = await db
      .select({ id: checkpoints.id })
      .from(checkpoints)
      .innerJoin(assignmentStudents, eq(checkpoints.assignmentId, assignmentStudents.assignmentId))
      .where(
        and(
          eq(checkpoints.id, checkpointId),
          eq(checkpoints.studentId, session.user.id),
          eq(assignmentStudents.studentId, session.user.id),
        ),
      )
      .limit(1);
    return owned ? null : { error: 'Checkpoint not found' };
  }
  if (role === 'instructor') {
    const [owned] = await db
      .select({ id: checkpoints.id })
      .from(checkpoints)
      .innerJoin(assignments, eq(checkpoints.assignmentId, assignments.id))
      .where(
        and(
          eq(checkpoints.id, checkpointId),
          eq(assignments.instructorId, session.user.id),
          isNull(assignments.deletedAt),
        ),
      )
      .limit(1);
    return owned ? null : { error: 'Checkpoint not found' };
  }
  return { error: 'Unauthorized' };
}
