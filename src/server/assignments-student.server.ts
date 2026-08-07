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
import { consultations } from '../db/schema/consultations';
import { getSessionFromHeaders } from './auth';
import { serverError, ErrorCode } from '../lib/errors';
import { computeEffectiveDeadline } from './due-dates.server';
import { isStudent } from '../lib/session-guards';
import type { z } from 'zod';
import type { ListStudentAssignmentsSchema, StudentAssignmentIdParamSchema } from './assignments';
import type { AssignmentContextProjection } from './assignments-context.server';

type ListStudentAssignmentsInput = z.infer<typeof ListStudentAssignmentsSchema>;
type StudentAssignmentIdParam = z.infer<typeof StudentAssignmentIdParamSchema>;

export async function listStudentAssignmentsHandler(args: { data: ListStudentAssignmentsInput }) {
  const session = await getSessionFromHeaders();
  if (!isStudent(session)) {
    return { assignments: [], total: 0 };
  }

  const { search, page, limit, termId, courseId, sectionId, status } = args.data;
  if (status && status !== 'active') return { assignments: [], total: 0 };

  const db = getDb();

  try {
    const conditions = [
      eq(assignmentStudents.studentId, session.user.id),
      eq(assignments.status, 'active'),
      isNull(assignments.deletedAt),
      eq(courseSections.status, 'active'),
      eq(academicTerms.status, 'active'),
    ];

    if (termId) conditions.push(eq(courseSections.termId, termId));
    if (courseId) conditions.push(eq(courseSections.courseId, courseId));
    if (sectionId) conditions.push(eq(assignments.sectionId, sectionId));
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
        .from(assignmentStudents)
        .innerJoin(assignments, eq(assignmentStudents.assignmentId, assignments.id))
        .innerJoin(assignmentTemplates, eq(assignments.templateId, assignmentTemplates.id))
        .innerJoin(courseSections, eq(assignments.sectionId, courseSections.id))
        .innerJoin(academicTerms, eq(courseSections.termId, academicTerms.id))
        .innerJoin(courses, eq(courseSections.courseId, courses.id))
        .innerJoin(
          sectionEnrollments,
          and(
            eq(sectionEnrollments.sectionId, assignments.sectionId),
            eq(sectionEnrollments.userId, session.user.id),
            eq(sectionEnrollments.role, 'student'),
            eq(sectionEnrollments.isActive, true),
          ),
        )
        .where(and(...conditions))
        .orderBy(assignments.createdAt)
        .limit(limit)
        .offset((page - 1) * limit),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(assignmentStudents)
        .innerJoin(assignments, eq(assignmentStudents.assignmentId, assignments.id))
        .innerJoin(courseSections, eq(assignments.sectionId, courseSections.id))
        .innerJoin(academicTerms, eq(courseSections.termId, academicTerms.id))
        .innerJoin(courses, eq(courseSections.courseId, courses.id))
        .innerJoin(
          sectionEnrollments,
          and(
            eq(sectionEnrollments.sectionId, assignments.sectionId),
            eq(sectionEnrollments.userId, session.user.id),
            eq(sectionEnrollments.role, 'student'),
            eq(sectionEnrollments.isActive, true),
          ),
        )
        .where(and(...conditions)),
    ]);

    const assignmentIds = rawAssignments.map((assignment) => assignment.id);
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

      for (const checkpoint of allCheckpoints) {
        const counts = countsByAssignment.get(checkpoint.assignmentId) ?? { total: 0, passed: 0 };
        counts.total++;
        if (checkpoint.state === 'passed') counts.passed++;
        countsByAssignment.set(checkpoint.assignmentId, counts);

        const assignmentCheckpoints = checkpointsByAssignment.get(checkpoint.assignmentId) ?? [];
        assignmentCheckpoints.push({
          state: checkpoint.state,
          dueDate: checkpoint.dueDate,
          order: checkpoint.order,
        });
        checkpointsByAssignment.set(checkpoint.assignmentId, assignmentCheckpoints);
      }

      for (const [id, assignmentCheckpoints] of checkpointsByAssignment) {
        effectiveDeadlineMap.set(id, computeEffectiveDeadline(assignmentCheckpoints));
      }

      for (const [id, counts] of countsByAssignment) {
        progressMap.set(
          id,
          counts.total > 0 ? Math.round((counts.passed / counts.total) * 100) : 0,
        );
      }
    }

    return {
      assignments: rawAssignments.map((assignment) => ({
        id: assignment.id,
        title: assignment.title,
        description: assignment.description,
        finalDeadline: assignment.finalDeadline,
        createdAt: assignment.createdAt,
        templateName: assignment.templateName,
        templateType: assignment.templateType,
        progressPercent: progressMap.get(assignment.id) ?? 0,
        effectiveDeadline: effectiveDeadlineMap.get(assignment.id) ?? null,
        sectionId: assignment.sectionId,
        mode: assignment.mode,
        status: assignment.status,
        context: toStudentAssignmentContext(assignment),
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
  if (!isStudent(session)) return null;

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
      .from(assignmentStudents)
      .innerJoin(assignments, eq(assignmentStudents.assignmentId, assignments.id))
      .innerJoin(assignmentTemplates, eq(assignments.templateId, assignmentTemplates.id))
      .innerJoin(users, eq(assignments.instructorId, users.id))
      .innerJoin(courseSections, eq(assignments.sectionId, courseSections.id))
      .innerJoin(academicTerms, eq(courseSections.termId, academicTerms.id))
      .innerJoin(courses, eq(courseSections.courseId, courses.id))
      .innerJoin(
        sectionEnrollments,
        and(
          eq(sectionEnrollments.sectionId, assignments.sectionId),
          eq(sectionEnrollments.userId, session.user.id),
          eq(sectionEnrollments.role, 'student'),
          eq(sectionEnrollments.isActive, true),
        ),
      )
      .where(
        and(
          eq(assignmentStudents.studentId, session.user.id),
          eq(assignments.id, id),
          eq(assignments.status, 'active'),
          isNull(assignments.deletedAt),
          eq(courseSections.status, 'active'),
          eq(academicTerms.status, 'active'),
        ),
      )
      .limit(1);

    if (!assignmentData) return null;

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
    const passedCount = checkpointsWithConsults.filter(
      (checkpoint) => checkpoint.state === 'passed',
    ).length;
    const progressPercent =
      totalCheckpointsCount > 0 ? Math.round((passedCount / totalCheckpointsCount) * 100) : 0;
    const effectiveDeadline = computeEffectiveDeadline(
      checkpointsWithConsults.map((checkpoint) => ({
        state: checkpoint.state,
        dueDate: checkpoint.dueDate,
        order: checkpoint.order,
      })),
    );

    const enrichedCheckpoints = checkpointsWithConsults.map((checkpoint, index) => {
      const blockingReasons: string[] = [];
      if (checkpoint.state === 'locked' && index > 0) {
        const previous = checkpointsWithConsults[index - 1];
        if (previous.state !== 'passed') blockingReasons.push('Previous checkpoint not passed');
      }

      const minConsults = checkpoint.minConsultations ?? 0;
      if (
        checkpoint.state === 'locked' &&
        minConsults > 0 &&
        checkpoint.verifiedConsultationCount < minConsults
      ) {
        blockingReasons.push(
          `Insufficient consultations: ${checkpoint.verifiedConsultationCount}/${minConsults} verified`,
        );
      }

      return {
        id: checkpoint.id,
        name: checkpoint.name,
        order: checkpoint.order,
        state: checkpoint.state,
        dueDate: checkpoint.dueDate,
        minConsultations: checkpoint.minConsultations,
        verifiedConsultationCount: checkpoint.verifiedConsultationCount,
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
      sectionId: assignmentData.sectionId,
      mode: assignmentData.mode,
      status: assignmentData.status,
      context: toStudentAssignmentContext(assignmentData),
      checkpoints: enrichedCheckpoints,
    };
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'getStudentAssignmentDetailHandler',
    });
  }
}

function toStudentAssignmentContext(row: {
  termId: number;
  termCode: string;
  termName: string;
  courseId: number;
  courseCode: string;
  courseName: string;
  sectionId: number;
  sectionCode: string;
  sectionName: string | null;
}): AssignmentContextProjection {
  return {
    term: { id: row.termId, code: row.termCode, name: row.termName },
    course: { id: row.courseId, code: row.courseCode, name: row.courseName },
    section: { id: row.sectionId, code: row.sectionCode, name: row.sectionName },
  };
}
