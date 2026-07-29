// Server-only handler for admin assignment operations
import { eq, and, isNull } from 'drizzle-orm';
import { getDb } from '../db/index';
import { assignments, checkpoints } from '../db/schema/assignments';
import { users } from '../db/schema/users';
import { getSessionFromHeaders } from './auth';
import { logAuditEvent } from '../lib/audit';
import { serverError, ErrorCode } from '../lib/errors';
import { logger } from '../lib/logger';
import type { z } from 'zod';
import type { ReassignAssignmentSchema } from './assignments';

// Admin reassigns an assignment to a different active instructor.
// Under_review checkpoints transition back to submitted for the new instructor.
export async function reassignAssignmentHandler(args: {
  data: z.infer<typeof ReassignAssignmentSchema>;
}) {
  const session = await getSessionFromHeaders();
  if (!session || (session.user.role !== 'admin' && session.user.role !== 'superadmin')) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const { assignmentId, newInstructorId } = args.data;
  const db = getDb();

  try {
    const result = await db.transaction(async (tx) => {
      const [assignment] = await tx
        .select()
        .from(assignments)
        .where(and(eq(assignments.id, assignmentId), isNull(assignments.deletedAt)))
        .for('update', { of: assignments });

      if (!assignment) {
        return serverError(ErrorCode.NOT_FOUND, 'Assignment not found');
      }

      const [instructor] = await tx
        .select()
        .from(users)
        .where(
          and(eq(users.id, newInstructorId), eq(users.role, 'instructor'), isNull(users.deletedAt)),
        )
        .for('update', { of: users });

      if (!instructor) {
        return serverError(
          ErrorCode.BAD_REQUEST,
          'Replacement instructor not found or not an active instructor',
        );
      }

      await tx
        .update(assignments)
        .set({ instructorId: newInstructorId })
        .where(eq(assignments.id, assignmentId));

      await tx
        .update(checkpoints)
        .set({ state: 'submitted' })
        .where(
          and(eq(checkpoints.assignmentId, assignmentId), eq(checkpoints.state, 'under_review')),
        );

      return { success: true };
    });

    try {
      await logAuditEvent({
        actorId: session.user.id,
        action: 'assignment.reassigned',
        entityType: 'assignment',
        entityId: String(assignmentId),
        details: { newInstructorId },
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.error({
        event: 'advisory_failed',
        handler: 'reassignAssignmentHandler',
        error: errMsg,
      });
    }

    return result;
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'reassignAssignmentHandler',
    });
  }
}
