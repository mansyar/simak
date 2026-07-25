// Server-only handlers (not imported by client code)
import { eq, and, isNull, sql, inArray } from 'drizzle-orm';
import { getDb } from '../db/index';
import { assignments, assignmentStudents, checkpoints } from '../db/schema/assignments';
import { assignmentTemplates, templateCheckpoints } from '../db/schema/templates';
import { users } from '../db/schema/users';
import { getSessionFromHeaders } from './auth';
import { logAuditEvent } from '../lib/audit';
import { serverError, ErrorCode, type ServerError } from '../lib/errors';
import { translateKey } from '../lib/i18n-server';
import { calculateDueDates, validateDueDates } from './due-dates.server';
import { createDefaultGradeConfig } from './assignments-extras.server';
import type { NonNullableSession } from '../lib/types';
import type { z } from 'zod';
import type {
  CreateAssignmentSchema,
  ListInstructorAssignmentsSchema,
  AssignmentIdParamSchema,
  ReassignAssignmentSchema,
} from './assignments';

type CreateAssignmentInput = z.infer<typeof CreateAssignmentSchema>;
type ListInstructorAssignmentsInput = z.infer<typeof ListInstructorAssignmentsSchema>;
type AssignmentIdParam = z.infer<typeof AssignmentIdParamSchema>;

export type InstructorAssignmentRow = {
  id: number;
  title: string;
  description: string | null;
  finalDeadline: string;
  createdAt: string | null;
  templateName: string;
  templateType: string;
  studentCount: number;
};

export type ListInstructorAssignmentsSuccess = {
  assignments: InstructorAssignmentRow[];
  total: number;
};

export type AssignmentDetailCheckpoint = {
  id: number;
  name: string;
  order: number;
  state: string;
  studentId: string;
  dueDate: string | null;
  minConsultations: number | null;
};

export type AssignmentDetailStudent = {
  id: string;
  name: string;
  email: string;
  passedCount: number;
  totalCheckpointsCount: number;
  progressPercent: number;
  activeCheckpoint: { id: number; name: string; state: string } | null;
  effectiveDeadline: string | null;
  checkpoints: AssignmentDetailCheckpoint[];
};

export type AssignmentDetailSuccess = {
  id: number;
  title: string;
  description: string | null;
  finalDeadline: string;
  createdAt: string | null;
  instructorId: string;
  templateName: string;
  templateType: string;
  students: AssignmentDetailStudent[];
};

function isInstructor(session: NonNullableSession | null): session is NonNullableSession {
  return !!session && session.user.role === 'instructor';
}

export async function createAssignmentHandler(args: { data: CreateAssignmentInput }) {
  const session = await getSessionFromHeaders();
  if (!isInstructor(session)) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const { templateId, title, description, finalDeadline, studentIds, overrideDueDates } = args.data;
  const db = getDb();

  try {
    const validStudents = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(inArray(users.id, studentIds), eq(users.role, 'student'), isNull(users.deletedAt)),
      );
    if (validStudents.length !== studentIds.length) {
      const locale = (session.user.locale || 'en') as 'en' | 'id';
      return serverError(
        ErrorCode.BAD_REQUEST,
        translateKey('assignments.errors.invalidStudentIds', locale),
      );
    }
    const result = await db.transaction(async (tx) => {
      const [insertedAssignment] = await tx
        .insert(assignments)
        .values({
          templateId,
          title,
          description,
          finalDeadline,
          instructorId: session.user.id,
        })
        .returning({ id: assignments.id });

      const assignmentId = insertedAssignment.id;

      const studentRows = studentIds.map((studentId) => ({
        assignmentId,
        studentId,
      }));
      await tx.insert(assignmentStudents).values(studentRows);

      const tCheckpoints = await tx
        .select({
          name: templateCheckpoints.name,
          order: templateCheckpoints.order,
          minConsultations: templateCheckpoints.minConsultations,
          estimatedDuration: templateCheckpoints.estimatedDuration,
        })
        .from(templateCheckpoints)
        .where(eq(templateCheckpoints.templateId, templateId))
        .orderBy(templateCheckpoints.order);

      const [assignmentRow] = await tx
        .select({ createdAt: assignments.createdAt })
        .from(assignments)
        .where(eq(assignments.id, assignmentId))
        .limit(1);

      const baseDate = assignmentRow?.createdAt ?? new Date();

      const checkpointDueDates = calculateDueDates(tCheckpoints, baseDate);

      if (overrideDueDates) {
        for (const override of overrideDueDates) {
          checkpointDueDates.set(override.checkpointOrder, override.dueDate);
        }
      }

      // Validate sequential ordering, past dates, and finalDeadline cap
      const validation = validateDueDates(checkpointDueDates, finalDeadline);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      if (tCheckpoints.length > 0) {
        const checkpointRows: {
          assignmentId: number;
          studentId: string;
          name: string;
          order: number;
          minConsultations: number;
          dueDate: Date;
          state: 'unlocked' | 'locked';
        }[] = [];
        for (const studentId of studentIds) {
          tCheckpoints.forEach((tcp) => {
            checkpointRows.push({
              assignmentId,
              studentId,
              name: tcp.name,
              order: tcp.order,
              minConsultations: tcp.minConsultations ?? 0,
              dueDate: checkpointDueDates.get(tcp.order) ?? new Date(),
              state: tcp.order === 1 ? ('unlocked' as const) : ('locked' as const),
            });
          });
        }
        await tx.insert(checkpoints).values(checkpointRows);
      }
      await createDefaultGradeConfig(tx, assignmentId);
      return { success: true, assignmentId };
    });

    const assignmentId = result.assignmentId;
    await logAuditEvent({
      actorId: session.user.id,
      action: 'assignment.created',
      entityType: 'assignment',
      entityId: String(assignmentId),
      details: { templateId, studentCount: studentIds.length, deadline: finalDeadline },
    });

    return result;
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Checkpoint')) {
      return serverError(ErrorCode.BAD_REQUEST, err.message);
    }
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'createAssignmentHandler',
    });
  }
}

export async function listInstructorAssignmentsHandler(args: {
  data: ListInstructorAssignmentsInput;
}): Promise<ListInstructorAssignmentsSuccess | ServerError> {
  const session = await getSessionFromHeaders();
  if (!isInstructor(session)) {
    return { assignments: [], total: 0 };
  }

  const { search, page, limit } = args.data;
  const db = getDb();

  try {
    const conditions = [
      eq(assignments.instructorId, session.user.id),
      isNull(assignments.deletedAt),
    ];

    if (search) {
      conditions.push(sql`${assignments.title} ILIKE ${'%' + search + '%'}`);
    }

    const [rawAssignments, [{ count }]] = await Promise.all([
      db
        .select({
          id: assignments.id,
          title: assignments.title,
          description: assignments.description,
          finalDeadline: assignments.finalDeadline,
          createdAt: assignments.createdAt,
          templateName: assignmentTemplates.name,
          templateType: assignmentTemplates.type,
        })
        .from(assignments)
        .innerJoin(assignmentTemplates, eq(assignments.templateId, assignmentTemplates.id))
        .where(and(...conditions))
        .orderBy(assignments.createdAt)
        .limit(limit)
        .offset((page - 1) * limit),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(assignments)
        .where(and(...conditions)),
    ]);

    // Fetch student counts for the assignments in a separate query
    const assignmentIds = rawAssignments.map((a) => a.id);
    let studentCounts: Map<number, number> = new Map();

    if (assignmentIds.length > 0) {
      const counts = await db
        .select({
          assignmentId: assignmentStudents.assignmentId,
          count: sql<number>`count(*)::int`,
        })
        .from(assignmentStudents)
        .where(inArray(assignmentStudents.assignmentId, assignmentIds))
        .groupBy(assignmentStudents.assignmentId);

      studentCounts = new Map(counts.map((c) => [c.assignmentId, c.count]));
    }

    const enrichedAssignments: InstructorAssignmentRow[] = rawAssignments.map((a) => ({
      id: a.id,
      title: a.title,
      description: a.description,
      finalDeadline: a.finalDeadline.toISOString(),
      createdAt: a.createdAt ? a.createdAt.toISOString() : null,
      templateName: a.templateName,
      templateType: a.templateType,
      studentCount: studentCounts.get(a.id) ?? 0,
    }));

    return {
      assignments: enrichedAssignments,
      total: Number(count),
    };
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'listInstructorAssignmentsHandler',
    });
  }
}

export async function getAssignmentDetailHandler(args: {
  data: AssignmentIdParam;
}): Promise<AssignmentDetailSuccess | ServerError | null> {
  const session = await getSessionFromHeaders();
  if (!isInstructor(session)) {
    return null;
  }

  const { id } = args.data;
  const db = getDb();

  try {
    const [assignment] = await db
      .select({
        id: assignments.id,
        title: assignments.title,
        description: assignments.description,
        finalDeadline: assignments.finalDeadline,
        createdAt: assignments.createdAt,
        templateName: assignmentTemplates.name,
        templateType: assignmentTemplates.type,
      })
      .from(assignments)
      .innerJoin(assignmentTemplates, eq(assignments.templateId, assignmentTemplates.id))
      .where(
        and(
          eq(assignments.id, id),
          eq(assignments.instructorId, session.user.id),
          isNull(assignments.deletedAt),
        ),
      )
      .limit(1);

    if (!assignment) {
      return null;
    }

    const studentsList = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
      })
      .from(assignmentStudents)
      .innerJoin(users, eq(assignmentStudents.studentId, users.id))
      .where(eq(assignmentStudents.assignmentId, id))
      .orderBy(users.name);

    const studentIds = studentsList.map((s) => s.id);
    const studentsWithProgress: AssignmentDetailStudent[] = [];

    if (studentIds.length > 0) {
      const allCheckpoints = await db
        .select({
          id: checkpoints.id,
          name: checkpoints.name,
          order: checkpoints.order,
          state: checkpoints.state,
          studentId: checkpoints.studentId,
          dueDate: checkpoints.dueDate,
          minConsultations: checkpoints.minConsultations,
        })
        .from(checkpoints)
        .where(eq(checkpoints.assignmentId, id))
        .orderBy(checkpoints.studentId, checkpoints.order);

      // Group checkpoints by studentId
      const checkpointsByStudent: Map<string, typeof allCheckpoints> = new Map();
      allCheckpoints.forEach((cp) => {
        if (!checkpointsByStudent.has(cp.studentId)) {
          checkpointsByStudent.set(cp.studentId, []);
        }
        checkpointsByStudent.get(cp.studentId)!.push(cp);
      });

      studentsList.forEach((s) => {
        const sCheckpoints = checkpointsByStudent.get(s.id) ?? [];
        const totalCheckpointsCount = sCheckpoints.length;
        const passedCount = sCheckpoints.filter((cp) => cp.state === 'passed').length;

        const activeCheckpoint = sCheckpoints.find((cp) => cp.state !== 'passed') ?? null;
        const effectiveCheckpoint =
          sCheckpoints.length > 0
            ? sCheckpoints.reduce((max, cp) => (cp.order > max.order ? cp : max), sCheckpoints[0])
            : undefined;

        studentsWithProgress.push({
          ...s,
          passedCount,
          totalCheckpointsCount,
          progressPercent:
            totalCheckpointsCount > 0 ? Math.round((passedCount / totalCheckpointsCount) * 100) : 0,
          activeCheckpoint: activeCheckpoint
            ? {
                id: activeCheckpoint.id,
                name: activeCheckpoint.name,
                state: activeCheckpoint.state,
              }
            : null,
          effectiveDeadline: effectiveCheckpoint?.dueDate?.toISOString() ?? null,
          checkpoints: sCheckpoints.map((cp) => ({
            id: cp.id,
            name: cp.name,
            order: cp.order,
            state: cp.state,
            studentId: cp.studentId,
            dueDate: cp.dueDate ? cp.dueDate.toISOString() : null,
            minConsultations: cp.minConsultations,
          })),
        });
      });
    }

    return {
      ...assignment,
      instructorId: session.user.id,
      finalDeadline: assignment.finalDeadline.toISOString(),
      createdAt: assignment.createdAt ? assignment.createdAt.toISOString() : null,
      students: studentsWithProgress,
    };
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'getAssignmentDetailHandler',
    });
  }
}

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
      console.error('Failed to log assignment reassignment audit event:', err);
    }

    return result;
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'reassignAssignmentHandler',
    });
  }
}

export {
  unlockCheckpointHandler,
  extendDeadlineHandler,
  listStudentAssignmentsHandler,
  getStudentAssignmentDetailHandler,
} from './assignments-extras.server';
