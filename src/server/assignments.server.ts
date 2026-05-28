// Server-only handlers (not imported by client code)
import { eq, and, isNull, sql, inArray } from 'drizzle-orm';
import { getDb } from '../db/index';
import { assignments, assignmentStudents, checkpoints } from '../db/schema/assignments';
import { assignmentTemplates, templateCheckpoints } from '../db/schema/templates';
import { users } from '../db/schema/users';
import { getSessionFromHeaders } from './auth';
import { logAuditEvent } from '../lib/audit';
import { consultations } from '../db/schema/consultations';
import type { z } from 'zod';
import type {
  CreateAssignmentSchema,
  ListInstructorAssignmentsSchema,
  AssignmentIdParamSchema,
  ListStudentAssignmentsSchema,
  StudentAssignmentIdParamSchema,
  UnlockCheckpointSchema,
  ExtendDeadlineSchema,
} from './assignments';

type CreateAssignmentInput = z.infer<typeof CreateAssignmentSchema>;
type ListInstructorAssignmentsInput = z.infer<typeof ListInstructorAssignmentsSchema>;
type AssignmentIdParam = z.infer<typeof AssignmentIdParamSchema>;
type ListStudentAssignmentsInput = z.infer<typeof ListStudentAssignmentsSchema>;
type StudentAssignmentIdParam = z.infer<typeof StudentAssignmentIdParamSchema>;
type UnlockCheckpointInput = z.infer<typeof UnlockCheckpointSchema>;
type ExtendDeadlineInput = z.infer<typeof ExtendDeadlineSchema>;

function isInstructor(
  session: any,
): session is { user: { id: string; role: string }; session: any } {
  return !!session && session.user.role === 'instructor';
}

export async function createAssignmentHandler(args: { data: CreateAssignmentInput }) {
  const session = await getSessionFromHeaders();
  if (!isInstructor(session)) {
    return { error: 'Unauthorized' };
  }

  const { templateId, title, description, finalDeadline, studentIds } = args.data;
  const db = getDb();

  try {
    const result = await db.transaction(async (tx) => {
      // 1. Insert assignment
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

      // 2. Map students
      const studentRows = studentIds.map((studentId) => ({
        assignmentId,
        studentId,
      }));
      await tx.insert(assignmentStudents).values(studentRows);

      // 3. Fetch template checkpoints
      const tCheckpoints = await tx
        .select({
          name: templateCheckpoints.name,
          order: templateCheckpoints.order,
          minConsultations: templateCheckpoints.minConsultations,
        })
        .from(templateCheckpoints)
        .where(eq(templateCheckpoints.templateId, templateId))
        .orderBy(templateCheckpoints.order);

      // 4. Instantiate checkpoints for each student
      if (tCheckpoints.length > 0) {
        const checkpointRows: any[] = [];
        for (const studentId of studentIds) {
          tCheckpoints.forEach((tcp) => {
            checkpointRows.push({
              assignmentId,
              studentId,
              name: tcp.name,
              order: tcp.order,
              minConsultations: tcp.minConsultations ?? 0,
              state: tcp.order === 1 ? ('unlocked' as const) : ('locked' as const),
            });
          });
        }
        await tx.insert(checkpoints).values(checkpointRows);
      }

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
    console.error('Failed to create assignment:', err);
    return { error: 'Internal Server Error' };
  }
}

export async function listInstructorAssignmentsHandler(args: {
  data: ListInstructorAssignmentsInput;
}) {
  const session = await getSessionFromHeaders();
  if (!isInstructor(session)) {
    return { assignments: [], total: 0 };
  }

  const { search, page, limit } = args.data;
  const db = getDb();

  const conditions = [eq(assignments.instructorId, session.user.id), isNull(assignments.deletedAt)];

  if (search) {
    conditions.push(sql`${assignments.title} ILIKE ${'%' + search + '%'}`);
  }

  // Fetch basic assignments
  const rawAssignments = await db
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
    .offset((page - 1) * limit);

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

  const enrichedAssignments = rawAssignments.map((a) => ({
    ...a,
    studentCount: studentCounts.get(a.id) ?? 0,
  }));

  // Fetch total count for pagination
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(assignments)
    .where(and(...conditions));

  return {
    assignments: enrichedAssignments,
    total: Number(count),
  };
}

export async function getAssignmentDetailHandler(args: { data: AssignmentIdParam }) {
  const session = await getSessionFromHeaders();
  if (!isInstructor(session)) {
    return null;
  }

  const { id } = args.data;
  const db = getDb();

  // 1. Fetch assignment details (verify ownership)
  const [assignment] = await db
    .select({
      id: assignments.id,
      title: assignments.title,
      description: assignments.description,
      finalDeadline: assignments.finalDeadline,
      createdAt: assignments.createdAt,
      instructorId: assignments.instructorId,
      templateName: assignmentTemplates.name,
      templateType: assignmentTemplates.type,
    })
    .from(assignments)
    .innerJoin(assignmentTemplates, eq(assignments.templateId, assignmentTemplates.id))
    .where(and(eq(assignments.id, id), isNull(assignments.deletedAt)))
    .limit(1);

  if (!assignment || assignment.instructorId !== session.user.id) {
    return null;
  }

  // 2. Fetch assigned students list
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
  const studentsWithProgress: any[] = [];

  if (studentIds.length > 0) {
    // 3. Fetch all checkpoints for these students
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

    // 4. Calculate progress & active checkpoint for each student
    studentsList.forEach((s) => {
      const sCheckpoints = checkpointsByStudent.get(s.id) ?? [];
      const totalCheckpointsCount = sCheckpoints.length;
      const passedCount = sCheckpoints.filter((cp) => cp.state === 'passed').length;

      const activeCheckpoint = sCheckpoints.find((cp) => cp.state !== 'passed') ?? null;

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
        checkpoints: sCheckpoints,
      });
    });
  }

  return {
    ...assignment,
    students: studentsWithProgress,
  };
}

export {
  unlockCheckpointHandler,
  extendDeadlineHandler,
  listStudentAssignmentsHandler,
  getStudentAssignmentDetailHandler,
} from './assignments-extras.server';
