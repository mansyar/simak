import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { getDb } from '../db/index';
import { assignments, assignmentStudents, checkpoints } from '../db/schema/assignments';
import {
  academicTerms,
  courseSections,
  courses,
  sectionEnrollments,
} from '../db/schema/academic-context';
import { assignmentTemplates } from '../db/schema/templates';
import { users } from '../db/schema/users';
import { getSessionFromHeaders } from './auth';
import { serverError, ErrorCode, type ServerError } from '../lib/errors';
import { isInstructor } from '../lib/session-guards';
import type { z } from 'zod';
import type { AssignmentIdParamSchema, ListInstructorAssignmentsSchema } from './assignments';
import type { AssignmentContextProjection } from './assignments-context.server';

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
  sectionId: number;
  mode: 'individual' | 'group';
  status: 'draft' | 'active' | 'archived';
  context: AssignmentContextProjection;
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
  sectionId: number;
  mode: 'individual' | 'group';
  status: 'draft' | 'active' | 'archived';
  context: AssignmentContextProjection;
  students: AssignmentDetailStudent[];
};

export async function listInstructorAssignmentsHandler(args: {
  data: ListInstructorAssignmentsInput;
}): Promise<ListInstructorAssignmentsSuccess | ServerError> {
  const session = await getSessionFromHeaders();
  if (!isInstructor(session)) {
    return { assignments: [], total: 0 };
  }

  const { search, page, limit, termId, courseId, sectionId, status } = args.data;
  const db = getDb();

  try {
    const conditions = [
      eq(assignments.instructorId, session.user.id),
      isNull(assignments.deletedAt),
      eq(courseSections.status, 'active'),
      eq(academicTerms.status, 'active'),
    ];

    if (termId) conditions.push(eq(courseSections.termId, termId));
    if (courseId) conditions.push(eq(courseSections.courseId, courseId));
    if (sectionId) conditions.push(eq(assignments.sectionId, sectionId));
    if (status) conditions.push(eq(assignments.status, status));
    if (search) conditions.push(sql`${assignments.title} ILIKE ${'%' + search + '%'}`);

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
          sectionId: courseSections.id,
          mode: assignments.mode,
          status: assignments.status,
          termId: academicTerms.id,
          termCode: academicTerms.code,
          termName: academicTerms.name,
          courseId: courses.id,
          courseCode: courses.code,
          courseName: courses.name,
          sectionCode: courseSections.code,
          sectionName: courseSections.name,
        })
        .from(assignments)
        .innerJoin(assignmentTemplates, eq(assignments.templateId, assignmentTemplates.id))
        .innerJoin(courseSections, eq(assignments.sectionId, courseSections.id))
        .innerJoin(academicTerms, eq(courseSections.termId, academicTerms.id))
        .innerJoin(courses, eq(courseSections.courseId, courses.id))
        .innerJoin(
          sectionEnrollments,
          and(
            eq(sectionEnrollments.sectionId, assignments.sectionId),
            eq(sectionEnrollments.userId, session.user.id),
            eq(sectionEnrollments.role, 'instructor'),
            eq(sectionEnrollments.isActive, true),
          ),
        )
        .where(and(...conditions))
        .orderBy(assignments.createdAt)
        .limit(limit)
        .offset((page - 1) * limit),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(assignments)
        .innerJoin(courseSections, eq(assignments.sectionId, courseSections.id))
        .innerJoin(academicTerms, eq(courseSections.termId, academicTerms.id))
        .innerJoin(
          sectionEnrollments,
          and(
            eq(sectionEnrollments.sectionId, assignments.sectionId),
            eq(sectionEnrollments.userId, session.user.id),
            eq(sectionEnrollments.role, 'instructor'),
            eq(sectionEnrollments.isActive, true),
          ),
        )
        .where(and(...conditions)),
    ]);

    const assignmentIds = rawAssignments.map((assignment) => assignment.id);
    let studentCounts = new Map<number, number>();

    if (assignmentIds.length > 0) {
      const counts = await db
        .select({
          assignmentId: assignmentStudents.assignmentId,
          count: sql<number>`count(*)::int`,
        })
        .from(assignmentStudents)
        .where(inArray(assignmentStudents.assignmentId, assignmentIds))
        .groupBy(assignmentStudents.assignmentId);

      studentCounts = new Map(counts.map((countRow) => [countRow.assignmentId, countRow.count]));
    }

    return {
      assignments: rawAssignments.map((assignment) => ({
        id: assignment.id,
        title: assignment.title,
        description: assignment.description,
        finalDeadline: assignment.finalDeadline.toISOString(),
        createdAt: assignment.createdAt ? assignment.createdAt.toISOString() : null,
        templateName: assignment.templateName,
        templateType: assignment.templateType,
        studentCount: studentCounts.get(assignment.id) ?? 0,
        sectionId: assignment.sectionId,
        mode: assignment.mode,
        status: assignment.status,
        context: {
          term: {
            id: assignment.termId,
            code: assignment.termCode,
            name: assignment.termName,
          },
          course: {
            id: assignment.courseId,
            code: assignment.courseCode,
            name: assignment.courseName,
          },
          section: {
            id: assignment.sectionId,
            code: assignment.sectionCode,
            name: assignment.sectionName,
          },
        },
      })),
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
        sectionId: courseSections.id,
        mode: assignments.mode,
        status: assignments.status,
        termId: academicTerms.id,
        termCode: academicTerms.code,
        termName: academicTerms.name,
        courseId: courses.id,
        courseCode: courses.code,
        courseName: courses.name,
        sectionCode: courseSections.code,
        sectionName: courseSections.name,
      })
      .from(assignments)
      .innerJoin(assignmentTemplates, eq(assignments.templateId, assignmentTemplates.id))
      .innerJoin(courseSections, eq(assignments.sectionId, courseSections.id))
      .innerJoin(academicTerms, eq(courseSections.termId, academicTerms.id))
      .innerJoin(courses, eq(courseSections.courseId, courses.id))
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
          eq(assignments.id, id),
          eq(assignments.instructorId, session.user.id),
          isNull(assignments.deletedAt),
          eq(courseSections.status, 'active'),
          eq(academicTerms.status, 'active'),
        ),
      )
      .limit(1);

    if (!assignment) return null;

    const studentsList = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(assignmentStudents)
      .innerJoin(users, eq(assignmentStudents.studentId, users.id))
      .where(eq(assignmentStudents.assignmentId, id))
      .orderBy(users.name);

    const studentIds = studentsList.map((student) => student.id);
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

      const checkpointsByStudent: Map<string, typeof allCheckpoints> = new Map();
      allCheckpoints.forEach((checkpoint) => {
        const studentCheckpoints = checkpointsByStudent.get(checkpoint.studentId) ?? [];
        studentCheckpoints.push(checkpoint);
        checkpointsByStudent.set(checkpoint.studentId, studentCheckpoints);
      });

      studentsList.forEach((student) => {
        const studentCheckpoints = checkpointsByStudent.get(student.id) ?? [];
        const totalCheckpointsCount = studentCheckpoints.length;
        const passedCount = studentCheckpoints.filter(
          (checkpoint) => checkpoint.state === 'passed',
        ).length;
        const activeCheckpoint =
          studentCheckpoints.find((checkpoint) => checkpoint.state !== 'passed') ?? null;
        const effectiveCheckpoint =
          studentCheckpoints.length > 0
            ? studentCheckpoints.reduce(
                (max, checkpoint) => (checkpoint.order > max.order ? checkpoint : max),
                studentCheckpoints[0],
              )
            : undefined;

        studentsWithProgress.push({
          ...student,
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
          checkpoints: studentCheckpoints.map((checkpoint) => ({
            id: checkpoint.id,
            name: checkpoint.name,
            order: checkpoint.order,
            state: checkpoint.state,
            studentId: checkpoint.studentId,
            dueDate: checkpoint.dueDate ? checkpoint.dueDate.toISOString() : null,
            minConsultations: checkpoint.minConsultations,
          })),
        });
      });
    }

    return {
      ...assignment,
      instructorId: session.user.id,
      finalDeadline: assignment.finalDeadline.toISOString(),
      createdAt: assignment.createdAt ? assignment.createdAt.toISOString() : null,
      sectionId: assignment.sectionId,
      mode: assignment.mode,
      status: assignment.status,
      context: {
        term: { id: assignment.termId, code: assignment.termCode, name: assignment.termName },
        course: {
          id: assignment.courseId,
          code: assignment.courseCode,
          name: assignment.courseName,
        },
        section: {
          id: assignment.sectionId,
          code: assignment.sectionCode,
          name: assignment.sectionName,
        },
      },
      students: studentsWithProgress,
    };
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'getAssignmentDetailHandler',
    });
  }
}
