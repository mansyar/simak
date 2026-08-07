import { and, eq, isNull } from 'drizzle-orm';
import { getDb } from '../db/index';
import { assignments } from '../db/schema/assignments';
import { courseSections, sectionEnrollments } from '../db/schema/academic-context';
import { getSessionFromHeaders } from './auth';
import { logAuditEvent } from '../lib/audit';
import { serverError, ErrorCode } from '../lib/errors';
import { isInstructor } from '../lib/session-guards';
import type { z } from 'zod';
import type { TransitionAssignmentStatusSchema } from './assignments';

type TransitionAssignmentStatusInput = z.infer<typeof TransitionAssignmentStatusSchema>;

const allowedTransitions = new Map([
  ['draft', new Set(['active'])],
  ['active', new Set(['archived'])],
  ['archived', new Set<string>()],
]);

export async function transitionAssignmentStatusHandler(args: {
  data: TransitionAssignmentStatusInput;
}) {
  const session = await getSessionFromHeaders();
  if (!isInstructor(session)) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const db = getDb();

  try {
    const transition = await db.transaction(async (tx) => {
      const [lockedAssignment] = await tx
        .select({
          id: assignments.id,
          status: assignments.status,
          sectionId: assignments.sectionId,
        })
        .from(assignments)
        .innerJoin(courseSections, eq(assignments.sectionId, courseSections.id))
        .innerJoin(
          sectionEnrollments,
          and(
            eq(sectionEnrollments.sectionId, assignments.sectionId),
            eq(sectionEnrollments.userId, session.user.id),
            eq(sectionEnrollments.role, 'instructor'),
            eq(sectionEnrollments.isActive, true),
          ),
        )
        .where(
          and(
            eq(assignments.id, args.data.assignmentId),
            eq(assignments.instructorId, session.user.id),
            isNull(assignments.deletedAt),
          ),
        )
        .limit(1)
        .for('update');

      if (!lockedAssignment) {
        return serverError(ErrorCode.NOT_FOUND, 'Assignment not found');
      }

      const nextStatuses = allowedTransitions.get(lockedAssignment.status);
      if (!nextStatuses?.has(args.data.status)) {
        return serverError(
          ErrorCode.CONFLICT,
          `Cannot transition assignment from ${lockedAssignment.status} to ${args.data.status}`,
        );
      }

      const [updatedAssignment] = await tx
        .update(assignments)
        .set({ status: args.data.status, updatedAt: new Date() })
        .where(
          and(
            eq(assignments.id, args.data.assignmentId),
            eq(assignments.status, lockedAssignment.status),
            isNull(assignments.deletedAt),
          ),
        )
        .returning({ id: assignments.id, status: assignments.status });

      if (!updatedAssignment) {
        return serverError(
          ErrorCode.CONFLICT,
          'Assignment changed before the transition completed',
        );
      }

      return {
        success: true as const,
        assignmentId: updatedAssignment.id,
        previousStatus: lockedAssignment.status,
        status: updatedAssignment.status,
        sectionId: lockedAssignment.sectionId,
      };
    });

    if ('error' in transition) return transition;

    await logAuditEvent({
      actorId: session.user.id,
      action: 'assignment.lifecycle.transitioned',
      entityType: 'assignment',
      entityId: String(transition.assignmentId),
      details: {
        previousStatus: transition.previousStatus,
        status: transition.status,
        sectionId: transition.sectionId,
      },
    });

    return {
      success: true,
      assignmentId: transition.assignmentId,
      status: transition.status,
    };
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'transitionAssignmentStatusHandler',
    });
  }
}
