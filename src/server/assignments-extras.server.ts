// Server-only handlers for student assignment views and deadline management
import { eq, and, isNull, sql, desc } from 'drizzle-orm';
import { getDb } from '../db/index';
import { assignments, checkpoints } from '../db/schema/assignments';
import { getSessionFromHeaders } from './auth';
import { logAuditEvent } from '../lib/audit';
import { serverError, ErrorCode } from '../lib/errors';
import { assignmentGradeConfig } from '../db/schema/gradebook';
import { isInstructor } from '../lib/session-guards';
import type { z } from 'zod';
import type { UnlockCheckpointSchema, ExtendDeadlineSchema } from './assignments';

type UnlockCheckpointInput = z.infer<typeof UnlockCheckpointSchema>;
type ExtendDeadlineInput = z.infer<typeof ExtendDeadlineSchema>;

/**
 * Unlock a locked checkpoint.
 * Only the assignment owner (instructor) can unlock checkpoints in their assignment.
 * Transitions checkpoint from 'locked' to 'unlocked' regardless of blocking reasons.
 */
export async function unlockCheckpointHandler(args: { data: UnlockCheckpointInput }) {
  const session = await getSessionFromHeaders();
  if (!isInstructor(session)) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const { checkpointId } = args.data;
  const db = getDb();

  try {
    const [checkpoint] = await db
      .select({
        id: checkpoints.id,
        state: checkpoints.state,
        assignmentInstructorId: assignments.instructorId,
        assignmentId: checkpoints.assignmentId,
        assignmentStatus: assignments.status,
      })
      .from(checkpoints)
      .innerJoin(assignments, eq(checkpoints.assignmentId, assignments.id))
      .where(and(eq(checkpoints.id, checkpointId), isNull(assignments.deletedAt)))
      .limit(1);

    if (!checkpoint) {
      return serverError(ErrorCode.NOT_FOUND, 'Checkpoint not found');
    }

    if (checkpoint.assignmentInstructorId !== session.user.id) {
      return serverError(ErrorCode.NOT_FOUND, 'Checkpoint not found');
    }

    if (checkpoint.assignmentStatus !== 'active') {
      return serverError(ErrorCode.CONFLICT, 'Assignment is not active');
    }

    if (checkpoint.state !== 'locked') {
      return serverError(ErrorCode.BAD_REQUEST, 'Checkpoint is not in locked state');
    }

    await db
      .update(checkpoints)
      .set({ state: 'unlocked', updatedAt: new Date() })
      .where(eq(checkpoints.id, checkpointId));

    await logAuditEvent({
      actorId: session.user.id,
      action: 'checkpoint.unlocked',
      entityType: 'checkpoint',
      entityId: String(checkpointId),
      details: { assignmentId: checkpoint.assignmentId },
    });

    return { success: true };
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'unlockCheckpointHandler',
    });
  }
}

/**
 * Extend a checkpoint's due date.
 * Only the assignment owner (instructor) can extend checkpoints in their assignment.
 * Can extend any checkpoint regardless of state.
 * Validates that newDueDate is in the future and maintains sequential ordering
 * relative to adjacent checkpoints. Does NOT modify assignments.finalDeadline
 * (immutable per Track 10).
 */
export async function extendDeadlineHandler(args: { data: ExtendDeadlineInput }) {
  const session = await getSessionFromHeaders();
  if (!isInstructor(session)) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const { checkpointId, newDueDate } = args.data;
  const db = getDb();

  try {
    const [checkpoint] = await db
      .select({
        id: checkpoints.id,
        assignmentInstructorId: assignments.instructorId,
        assignmentId: checkpoints.assignmentId,
        studentId: checkpoints.studentId,
        order: checkpoints.order,
        assignmentStatus: assignments.status,
      })
      .from(checkpoints)
      .innerJoin(assignments, eq(checkpoints.assignmentId, assignments.id))
      .where(and(eq(checkpoints.id, checkpointId), isNull(assignments.deletedAt)))
      .limit(1);

    if (!checkpoint) {
      return serverError(ErrorCode.NOT_FOUND, 'Checkpoint not found');
    }

    if (checkpoint.assignmentInstructorId !== session.user.id) {
      return serverError(ErrorCode.NOT_FOUND, 'Checkpoint not found');
    }

    if (checkpoint.assignmentStatus !== 'active') {
      return serverError(ErrorCode.CONFLICT, 'Assignment is not active');
    }

    // FR-5.1: Validate newDueDate is in the future
    if (newDueDate <= new Date()) {
      return serverError(ErrorCode.BAD_REQUEST, 'New deadline must be in the future');
    }

    // FR-5.2: Validate sequential ordering relative to adjacent checkpoints
    const [prevCheckpoint] = await db
      .select({ dueDate: checkpoints.dueDate })
      .from(checkpoints)
      .where(
        and(
          eq(checkpoints.assignmentId, checkpoint.assignmentId),
          eq(checkpoints.studentId, checkpoint.studentId),
          sql`${checkpoints.order} < ${checkpoint.order}`,
        ),
      )
      .orderBy(desc(checkpoints.order))
      .limit(1);

    if (prevCheckpoint?.dueDate && newDueDate <= prevCheckpoint.dueDate) {
      return serverError(
        ErrorCode.BAD_REQUEST,
        'New deadline must be after the previous checkpoint deadline',
      );
    }

    const [nextCheckpoint] = await db
      .select({ dueDate: checkpoints.dueDate })
      .from(checkpoints)
      .where(
        and(
          eq(checkpoints.assignmentId, checkpoint.assignmentId),
          eq(checkpoints.studentId, checkpoint.studentId),
          sql`${checkpoints.order} > ${checkpoint.order}`,
        ),
      )
      .orderBy(checkpoints.order)
      .limit(1);

    if (nextCheckpoint?.dueDate && newDueDate >= nextCheckpoint.dueDate) {
      return serverError(
        ErrorCode.BAD_REQUEST,
        'New deadline must be before the next checkpoint deadline',
      );
    }

    await db
      .update(checkpoints)
      .set({ dueDate: newDueDate, updatedAt: new Date() })
      .where(eq(checkpoints.id, checkpointId));

    await logAuditEvent({
      actorId: session.user.id,
      action: 'deadline.extended',
      entityType: 'checkpoint',
      entityId: String(checkpointId),
      details: { assignmentId: checkpoint.assignmentId, newDueDate: newDueDate.toISOString() },
    });

    return { success: true };
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'extendDeadlineHandler',
    });
  }
}

/**
 * Create a default grade config for a newly created assignment.
 * Called inside the assignment creation transaction.
 */
export async function createDefaultGradeConfig(
  tx: ReturnType<typeof getDb>,
  assignmentId: number,
): Promise<void> {
  await tx.insert(assignmentGradeConfig).values({
    assignmentId,
    gradingScheme: 'equal_weight',
    customWeights: null,
    letterGradeBounds: { A: 90, B: 80, C: 70, D: 60 },
  });
}
