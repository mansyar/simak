// Server-only handlers for student assignment views and deadline management
import { eq, and, isNull, sql, inArray, desc } from 'drizzle-orm';
import { getDb } from '../db/index';
import { assignments, assignmentStudents, checkpoints } from '../db/schema/assignments';
import { assignmentTemplates } from '../db/schema/templates';
import { users } from '../db/schema/users';
import { getSessionFromHeaders } from './auth';
import { logAuditEvent } from '../lib/audit';
import { serverError, ErrorCode } from '../lib/errors';
import { consultations } from '../db/schema/consultations';
import { computeEffectiveDeadline } from './due-dates.server';
import type { NonNullableSession } from '../lib/types';
import type { z } from 'zod';
import type {
  ListStudentAssignmentsSchema,
  StudentAssignmentIdParamSchema,
  UnlockCheckpointSchema,
  ExtendDeadlineSchema,
} from './assignments';

type ListStudentAssignmentsInput = z.infer<typeof ListStudentAssignmentsSchema>;
type StudentAssignmentIdParam = z.infer<typeof StudentAssignmentIdParamSchema>;
type UnlockCheckpointInput = z.infer<typeof UnlockCheckpointSchema>;
type ExtendDeadlineInput = z.infer<typeof ExtendDeadlineSchema>;

function isInstructor(session: NonNullableSession | null): session is NonNullableSession {
  return !!session && session.user.role === 'instructor';
}

function isStudent(session: NonNullableSession | null): session is NonNullableSession {
  return !!session && session.user.role === 'student';
}

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

export async function listStudentAssignmentsHandler(args: { data: ListStudentAssignmentsInput }) {
  const session = await getSessionFromHeaders();
  if (!isStudent(session)) {
    return { assignments: [], total: 0 };
  }

  const { search, page, limit } = args.data;
  const db = getDb();

  try {
    const conditions = [isNull(assignments.deletedAt)];

    if (search) {
      conditions.push(sql`${assignments.title} ILIKE ${'%' + search + '%'}`);
    }

    const rawAssignments = await db
      .select({
        id: assignments.id,
        title: assignments.title,
        description: assignments.description,
        finalDeadline: assignments.finalDeadline,
        createdAt: assignments.createdAt,
        templateName: assignmentTemplates.name,
        templateType: assignmentTemplates.type,
        studentId: assignmentStudents.studentId,
      })
      .from(assignmentStudents)
      .innerJoin(assignments, eq(assignmentStudents.assignmentId, assignments.id))
      .innerJoin(assignmentTemplates, eq(assignments.templateId, assignmentTemplates.id))
      .where(and(eq(assignmentStudents.studentId, session.user.id), ...conditions))
      .orderBy(assignments.createdAt)
      .limit(limit)
      .offset((page - 1) * limit);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(assignmentStudents)
      .innerJoin(assignments, eq(assignmentStudents.assignmentId, assignments.id))
      .where(and(eq(assignmentStudents.studentId, session.user.id), ...conditions));

    // Calculate progress and effective deadline per assignment from checkpoint states
    const assignmentIds = rawAssignments.map((a) => a.id);
    const progressMap = new Map<number, number>();
    const effectiveDeadlineMap = new Map<number, Date | null>();

    if (assignmentIds.length > 0) {
      const allCheckpoints = await db
        .select({
          assignmentId: checkpoints.assignmentId,
          state: checkpoints.state,
          dueDate: checkpoints.dueDate,
          order: checkpoints.order,
        })
        .from(checkpoints)
        .where(
          and(
            inArray(checkpoints.assignmentId, assignmentIds),
            eq(checkpoints.studentId, session.user.id),
          ),
        );

      const countsByAssignment = new Map<number, { total: number; passed: number }>();
      const checkpointsByAssignment = new Map<
        number,
        { state: string; dueDate: Date | null; order: number }[]
      >();
      for (const cp of allCheckpoints) {
        const existing = countsByAssignment.get(cp.assignmentId) ?? { total: 0, passed: 0 };
        existing.total++;
        if (cp.state === 'passed') existing.passed++;
        countsByAssignment.set(cp.assignmentId, existing);

        if (!checkpointsByAssignment.has(cp.assignmentId)) {
          checkpointsByAssignment.set(cp.assignmentId, []);
        }
        checkpointsByAssignment.get(cp.assignmentId)!.push({
          state: cp.state,
          dueDate: cp.dueDate,
          order: cp.order,
        });
      }

      for (const [id, cps] of checkpointsByAssignment) {
        effectiveDeadlineMap.set(id, computeEffectiveDeadline(cps));
      }

      for (const [id, counts] of countsByAssignment) {
        progressMap.set(
          id,
          counts.total > 0 ? Math.round((counts.passed / counts.total) * 100) : 0,
        );
      }
    }

    return {
      assignments: rawAssignments.map((a) => ({
        id: a.id,
        title: a.title,
        description: a.description,
        finalDeadline: a.finalDeadline,
        createdAt: a.createdAt,
        templateName: a.templateName,
        templateType: a.templateType,
        progressPercent: progressMap.get(a.id) ?? 0,
        effectiveDeadline: effectiveDeadlineMap.get(a.id) ?? null,
      })),
      total: Number(count),
    };
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'listStudentAssignmentsHandler',
    });
  }
}

export async function getStudentAssignmentDetailHandler(args: { data: StudentAssignmentIdParam }) {
  const session = await getSessionFromHeaders();
  if (!isStudent(session)) {
    return null;
  }

  const { id } = args.data;
  const db = getDb();

  try {
    const [assignmentData] = await db
      .select({
        id: assignments.id,
        title: assignments.title,
        description: assignments.description,
        finalDeadline: assignments.finalDeadline,
        createdAt: assignments.createdAt,
        instructorName: users.name,
        templateName: assignmentTemplates.name,
        templateType: assignmentTemplates.type,
        maxExtensionDays: assignments.maxExtensionDays,
        maxTotalExtensions: assignments.maxTotalExtensions,
      })
      .from(assignmentStudents)
      .innerJoin(assignments, eq(assignmentStudents.assignmentId, assignments.id))
      .innerJoin(assignmentTemplates, eq(assignments.templateId, assignmentTemplates.id))
      .innerJoin(users, eq(assignments.instructorId, users.id))
      .where(
        and(
          eq(assignmentStudents.studentId, session.user.id),
          eq(assignments.id, id),
          isNull(assignments.deletedAt),
        ),
      )
      .limit(1);

    if (!assignmentData) {
      return null;
    }

    const checkpointsWithConsults = await db
      .select({
        id: checkpoints.id,
        name: checkpoints.name,
        order: checkpoints.order,
        state: checkpoints.state,
        dueDate: checkpoints.dueDate,
        minConsultations: checkpoints.minConsultations,
        verifiedConsultationCount: sql<number>`COALESCE(COUNT(CASE WHEN ${consultations.status} = 'verified' THEN 1 END), 0)::int`,
      })
      .from(checkpoints)
      .leftJoin(
        consultations,
        and(
          eq(consultations.checkpointId, checkpoints.id),
          eq(consultations.studentId, session.user.id),
        ),
      )
      .where(and(eq(checkpoints.assignmentId, id), eq(checkpoints.studentId, session.user.id)))
      .groupBy(
        checkpoints.id,
        checkpoints.name,
        checkpoints.order,
        checkpoints.state,
        checkpoints.dueDate,
        checkpoints.minConsultations,
      )
      .orderBy(checkpoints.order);

    const totalCheckpointsCount = checkpointsWithConsults.length;
    const passedCount = checkpointsWithConsults.filter((cp) => cp.state === 'passed').length;
    const progressPercent =
      totalCheckpointsCount > 0 ? Math.round((passedCount / totalCheckpointsCount) * 100) : 0;

    const effectiveDeadline = computeEffectiveDeadline(
      checkpointsWithConsults.map((cp) => ({
        state: cp.state,
        dueDate: cp.dueDate,
        order: cp.order,
      })),
    );

    const enrichedCheckpoints = checkpointsWithConsults.map((cp, index) => {
      const blockingReasons: string[] = [];

      if (cp.state === 'locked') {
        if (index > 0) {
          const prev = checkpointsWithConsults[index - 1];
          if (prev.state !== 'passed') {
            blockingReasons.push('Previous checkpoint not passed');
          }
        }

        const minConsults = cp.minConsultations ?? 0;
        if (minConsults > 0 && cp.verifiedConsultationCount < minConsults) {
          blockingReasons.push(
            `Insufficient consultations: ${cp.verifiedConsultationCount}/${minConsults} verified`,
          );
        }
      }

      return {
        id: cp.id,
        name: cp.name,
        order: cp.order,
        state: cp.state,
        dueDate: cp.dueDate,
        minConsultations: cp.minConsultations,
        verifiedConsultationCount: cp.verifiedConsultationCount,
        blockingReasons: blockingReasons.length > 0 ? blockingReasons : undefined,
      };
    });

    return {
      id: assignmentData.id,
      title: assignmentData.title,
      description: assignmentData.description,
      finalDeadline: assignmentData.finalDeadline,
      createdAt: assignmentData.createdAt,
      instructorName: assignmentData.instructorName,
      templateName: assignmentData.templateName,
      templateType: assignmentData.templateType,
      maxExtensionDays: assignmentData.maxExtensionDays ?? 7,
      maxTotalExtensions: assignmentData.maxTotalExtensions ?? 3,
      progressPercent,
      effectiveDeadline,
      checkpoints: enrichedCheckpoints,
    };
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'getStudentAssignmentDetailHandler',
    });
  }
}
