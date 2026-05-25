// Server-only handlers (not imported by client code)
import { eq, and, isNull, sql, inArray } from 'drizzle-orm';
import { getDb } from '../db/index';
import { assignments, assignmentStudents, checkpoints } from '../db/schema/assignments';
import { assignmentTemplates, templateCheckpoints } from '../db/schema/templates';
import { users } from '../db/schema/users';
import { getSessionFromHeaders } from './auth';
import { consultations } from '../db/schema/consultations';
import type { z } from 'zod';
import type {
  CreateAssignmentSchema,
  ListInstructorAssignmentsSchema,
  AssignmentIdParamSchema,
  ListStudentAssignmentsSchema,
  StudentAssignmentIdParamSchema,
  UnlockCheckpointSchema,
} from './assignments';

type CreateAssignmentInput = z.infer<typeof CreateAssignmentSchema>;
type ListInstructorAssignmentsInput = z.infer<typeof ListInstructorAssignmentsSchema>;
type AssignmentIdParam = z.infer<typeof AssignmentIdParamSchema>;
type ListStudentAssignmentsInput = z.infer<typeof ListStudentAssignmentsSchema>;
type StudentAssignmentIdParam = z.infer<typeof StudentAssignmentIdParamSchema>;
type UnlockCheckpointInput = z.infer<typeof UnlockCheckpointSchema>;

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
              minConsultations: 0, // default is 0 or copied
              state: tcp.order === 1 ? ('unlocked' as const) : ('locked' as const),
            });
          });
        }
        await tx.insert(checkpoints).values(checkpointRows);
      }

      return { success: true, assignmentId };
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

// ---- Manual Deadline Management Handlers ----

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

  // 1. Fetch checkpoint with assignment info (verify ownership via instructorId)
  const [checkpoint] = await db
    .select({
      id: checkpoints.id,
      state: checkpoints.state,
      assignmentInstructorId: assignments.instructorId,
    })
    .from(checkpoints)
    .innerJoin(assignments, eq(checkpoints.assignmentId, assignments.id))
    .where(and(eq(checkpoints.id, checkpointId), isNull(assignments.deletedAt)))
    .limit(1);

  if (!checkpoint) {
    return { error: 'Checkpoint not found' };
  }

  // Verify ownership
  if (checkpoint.assignmentInstructorId !== session.user.id) {
    return { error: 'Checkpoint not found' };
  }

  // 2. Verify checkpoint is in locked state
  if (checkpoint.state !== 'locked') {
    return { error: 'Checkpoint is not in locked state' };
  }

  // 3. Transition to unlocked
  await db
    .update(checkpoints)
    .set({ state: 'unlocked', updatedAt: new Date() })
    .where(eq(checkpoints.id, checkpointId));

  return { success: true };
}

// ---- Student Helpers ----

function isStudent(session: any): session is { user: { id: string; role: string }; session: any } {
  return !!session && session.user.role === 'student';
}

// ---- Student Assignment Handlers ----

export async function listStudentAssignmentsHandler(args: { data: ListStudentAssignmentsInput }) {
  const session = await getSessionFromHeaders();
  if (!isStudent(session)) {
    return { assignments: [], total: 0 };
  }

  const { search, page, limit } = args.data;
  const db = getDb();

  // Build conditions: assigned to this student, not deleted
  const conditions = [isNull(assignments.deletedAt)];

  if (search) {
    conditions.push(sql`${assignments.title} ILIKE ${'%' + search + '%'}`);
  }

  // Fetch assignments through the assignmentStudents join
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

  // Fetch total count for pagination
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

  // 1. Verify the student is assigned to this assignment via assignmentStudents join
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

  // 2. Fetch checkpoints for this student & assignment, with consultation counts
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

  // 3. Calculate progress
  const totalCheckpointsCount = checkpointsWithConsults.length;
  const passedCount = checkpointsWithConsults.filter((cp) => cp.state === 'passed').length;
  const progressPercent =
    totalCheckpointsCount > 0 ? Math.round((passedCount / totalCheckpointsCount) * 100) : 0;

  // 4. Enrich checkpoints with blocking reasons
  const enrichedCheckpoints = checkpointsWithConsults.map((cp, index) => {
    const blockingReasons: string[] = [];

    if (cp.state === 'locked') {
      // Check if previous checkpoint is not passed
      if (index > 0) {
        const prev = checkpointsWithConsults[index - 1];
        if (prev.state !== 'passed') {
          blockingReasons.push('Previous checkpoint not passed');
        }
      }

      // Check consultation requirements
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
