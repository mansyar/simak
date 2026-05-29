// Server-only handlers for student assignment views and deadline management
import { eq, and, isNull, sql } from 'drizzle-orm';
import { getDb } from '../db/index';
import { assignments, assignmentStudents, checkpoints } from '../db/schema/assignments';
import { assignmentTemplates } from '../db/schema/templates';
import { users } from '../db/schema/users';
import { getSessionFromHeaders } from './auth';
import { logAuditEvent } from '../lib/audit';
import { consultations } from '../db/schema/consultations';
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
    return { error: 'Unauthorized' };
  }

  const { checkpointId } = args.data;
  const db = getDb();

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
    return { error: 'Checkpoint not found' };
  }

  if (checkpoint.assignmentInstructorId !== session.user.id) {
    return { error: 'Checkpoint not found' };
  }

  if (checkpoint.state !== 'locked') {
    return { error: 'Checkpoint is not in locked state' };
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
}

/**
 * Extend a checkpoint's due date.
 * Only the assignment owner (instructor) can extend checkpoints in their assignment.
 * Can extend any checkpoint regardless of state.
 */
export async function extendDeadlineHandler(args: { data: ExtendDeadlineInput }) {
  const session = await getSessionFromHeaders();
  if (!isInstructor(session)) {
    return { error: 'Unauthorized' };
  }

  const { checkpointId, newDueDate } = args.data;
  const db = getDb();

  const [checkpoint] = await db
    .select({
      id: checkpoints.id,
      assignmentInstructorId: assignments.instructorId,
      assignmentId: checkpoints.assignmentId,
    })
    .from(checkpoints)
    .innerJoin(assignments, eq(checkpoints.assignmentId, assignments.id))
    .where(and(eq(checkpoints.id, checkpointId), isNull(assignments.deletedAt)))
    .limit(1);

  if (!checkpoint) {
    return { error: 'Checkpoint not found' };
  }

  if (checkpoint.assignmentInstructorId !== session.user.id) {
    return { error: 'Checkpoint not found' };
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
}

export async function listStudentAssignmentsHandler(args: { data: ListStudentAssignmentsInput }) {
  const session = await getSessionFromHeaders();
  if (!isStudent(session)) {
    return { assignments: [], total: 0 };
  }

  const { search, page, limit } = args.data;
  const db = getDb();

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

  return {
    assignments: rawAssignments.map((a) => ({
      id: a.id,
      title: a.title,
      description: a.description,
      finalDeadline: a.finalDeadline,
      createdAt: a.createdAt,
      templateName: a.templateName,
      templateType: a.templateType,
    })),
    total: Number(count),
  };
}

export async function getStudentAssignmentDetailHandler(args: { data: StudentAssignmentIdParam }) {
  const session = await getSessionFromHeaders();
  if (!isStudent(session)) {
    return null;
  }

  const { id } = args.data;
  const db = getDb();

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
    progressPercent,
    checkpoints: enrichedCheckpoints,
  };
}
