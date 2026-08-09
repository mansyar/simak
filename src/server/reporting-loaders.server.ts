import { and, asc, desc, eq, isNull, ne, sql, type SQL } from 'drizzle-orm';
import { getDb } from '@/db/index';
import { academicRecords } from '@/db/schema/academic-records';
import {
  academicTerms,
  courses,
  courseSections,
  sectionEnrollments,
} from '@/db/schema/academic-context';
import { assignments, assignmentStudents, checkpoints } from '@/db/schema/assignments';
import { users } from '@/db/schema/users';
import { ErrorCode, serverError } from '@/lib/errors';
import type { ReportingRole } from '@/lib/reporting-policy';
import { getSessionFromHeaders } from '@/server/auth';
import {
  activeAcademicRecordCondition,
  aggregateAcademicRecordGpa,
} from './academic-records-extras.server';
import type { OfficialTranscriptInput, ReportLoaderFilters } from './reporting';

const DATA_NOT_FOUND = () => serverError(ErrorCode.NOT_FOUND, 'Report data not found');
const MAX_SUMMARY_GROUPS = 100;
const MAX_TRANSCRIPT_RECORDS = 500;

function filterConditions(filters: ReportLoaderFilters): SQL[] {
  const conditions: SQL[] = [];
  if (filters.termId) conditions.push(eq(courseSections.termId, filters.termId));
  if (filters.courseId) conditions.push(eq(courseSections.courseId, filters.courseId));
  if (filters.sectionId) conditions.push(eq(courseSections.id, filters.sectionId));
  if (filters.cohort) conditions.push(eq(courseSections.cohort, filters.cohort));
  return conditions;
}

async function hasAuthorizedScope(
  userId: string,
  role: ReportingRole,
  filters: ReportLoaderFilters,
  transcriptStudentId?: string,
) {
  const conditions = filterConditions(filters);
  if (!conditions.length) return true;

  let query = getDb()
    .select({ sectionId: courseSections.id })
    .from(courseSections)
    .innerJoin(academicTerms, eq(academicTerms.id, courseSections.termId))
    .innerJoin(courses, eq(courses.id, courseSections.courseId));

  if (role === 'instructor') {
    query = query.innerJoin(
      sectionEnrollments,
      and(
        eq(sectionEnrollments.sectionId, courseSections.id),
        eq(sectionEnrollments.userId, userId),
        eq(sectionEnrollments.role, 'instructor'),
        eq(sectionEnrollments.isActive, true),
      ),
    );
    conditions.push(eq(courseSections.status, 'active'), eq(academicTerms.status, 'active'));
  } else if (role === 'student') {
    query = query.innerJoin(
      academicRecords,
      and(
        eq(academicRecords.courseSectionId, courseSections.id),
        eq(academicRecords.studentId, transcriptStudentId ?? userId),
      ),
    );
  } else {
    conditions.push(ne(courseSections.status, 'archived'));
  }

  const rows = await query.where(and(...conditions)).limit(1);
  return rows.length > 0;
}

function requireRole(
  session: Awaited<ReturnType<typeof getSessionFromHeaders>>,
  roles: ReportingRole[],
) {
  if (!session) return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  if (!roles.includes(session.user.role as ReportingRole)) {
    return serverError(ErrorCode.FORBIDDEN, 'Forbidden');
  }
  return session;
}

function internalError(error: unknown, handler: string) {
  return serverError(ErrorCode.INTERNAL, 'Internal Server Error', { cause: error, handler });
}

export async function getInstitutionalAcademicSummaryHandler(args: { data: ReportLoaderFilters }) {
  const session = requireRole(await getSessionFromHeaders(), ['admin', 'superadmin']);
  if ('error' in session) return session;

  try {
    if (
      !(await hasAuthorizedScope(session.user.id, session.user.role as ReportingRole, args.data))
    ) {
      return DATA_NOT_FOUND();
    }
    const conditions = [activeAcademicRecordCondition, ...filterConditions(args.data)];
    const [totals] = await getDb()
      .select({
        studentCount: sql<number>`count(DISTINCT ${academicRecords.studentId})::int`,
        recordCount: sql<number>`count(*)::int`,
        totalCredits: sql<string>`sum(${academicRecords.credits})`,
        averageScore: sql<string | null>`avg(${academicRecords.numericScore})`,
      })
      .from(academicRecords)
      .innerJoin(courseSections, eq(courseSections.id, academicRecords.courseSectionId))
      .where(and(...conditions))
      .limit(1);
    const rows = await getDb()
      .select({
        status: academicRecords.status,
        recordCount: sql<number>`count(*)::int`,
      })
      .from(academicRecords)
      .innerJoin(courseSections, eq(courseSections.id, academicRecords.courseSectionId))
      .where(and(...conditions))
      .groupBy(academicRecords.status)
      .orderBy(asc(academicRecords.status))
      .limit(MAX_SUMMARY_GROUPS);

    return {
      filters: args.data,
      totals: {
        students: Number(totals?.studentCount ?? 0),
        records: Number(totals?.recordCount ?? 0),
        credits: Number(totals?.totalCredits ?? 0),
        averageScore:
          totals?.averageScore === null || totals?.averageScore === undefined
            ? null
            : Number(totals.averageScore),
      },
      outcomes: rows.map((row) => ({ status: row.status, count: Number(row.recordCount) })),
    };
  } catch (error) {
    return internalError(error, 'getInstitutionalAcademicSummaryHandler');
  }
}

export async function getAnalyticsSummaryHandler(args: { data: ReportLoaderFilters }) {
  const session = requireRole(await getSessionFromHeaders(), ['admin', 'superadmin', 'instructor']);
  if ('error' in session) return session;
  const role = session.user.role as ReportingRole;

  try {
    if (!(await hasAuthorizedScope(session.user.id, role, args.data))) return DATA_NOT_FOUND();
    const conditions = filterConditions(args.data);
    if (role === 'instructor') {
      conditions.push(
        eq(sectionEnrollments.userId, session.user.id),
        eq(sectionEnrollments.role, 'instructor'),
        eq(sectionEnrollments.isActive, true),
        eq(courseSections.status, 'active'),
        eq(academicTerms.status, 'active'),
      );
    } else {
      conditions.push(ne(courseSections.status, 'archived'));
    }

    let query = getDb()
      .select({
        sectionId: courseSections.id,
        sectionCode: courseSections.code,
        students: sql<number>`count(DISTINCT ${assignmentStudents.studentId})::int`,
        activeAssignments: sql<number>`count(DISTINCT ${assignments.id}) FILTER (WHERE ${assignments.status} = 'active')::int`,
        passedCheckpoints: sql<number>`count(DISTINCT ${checkpoints.id}) FILTER (WHERE ${checkpoints.state} = 'passed')::int`,
        totalCheckpoints: sql<number>`count(DISTINCT ${checkpoints.id})::int`,
      })
      .from(courseSections)
      .innerJoin(academicTerms, eq(academicTerms.id, courseSections.termId))
      .leftJoin(
        assignments,
        and(eq(assignments.sectionId, courseSections.id), isNull(assignments.deletedAt)),
      )
      .leftJoin(assignmentStudents, eq(assignmentStudents.assignmentId, assignments.id))
      .leftJoin(checkpoints, eq(checkpoints.assignmentId, assignments.id));
    if (role === 'instructor') {
      query = query.innerJoin(
        sectionEnrollments,
        eq(sectionEnrollments.sectionId, courseSections.id),
      );
    }
    const rows = await query
      .where(and(...conditions))
      .groupBy(courseSections.id, courseSections.code)
      .orderBy(asc(courseSections.code))
      .limit(MAX_SUMMARY_GROUPS);

    return {
      filters: args.data,
      sections: rows.map((row) => {
        const total = Number(row.totalCheckpoints);
        const passed = Number(row.passedCheckpoints);
        return {
          sectionId: row.sectionId,
          sectionCode: row.sectionCode,
          students: Number(row.students),
          activeAssignments: Number(row.activeAssignments),
          passedCheckpoints: passed,
          totalCheckpoints: total,
          completionRate: total ? Math.round((passed / total) * 100) : 0,
        };
      }),
    };
  } catch (error) {
    return internalError(error, 'getAnalyticsSummaryHandler');
  }
}

export async function getOfficialTranscriptHandler(args: { data: OfficialTranscriptInput }) {
  const session = requireRole(await getSessionFromHeaders(), ['student', 'admin', 'superadmin']);
  if ('error' in session) return session;
  const role = session.user.role as ReportingRole;
  if (role === 'student' && args.data.studentId && args.data.studentId !== session.user.id) {
    return DATA_NOT_FOUND();
  }
  const studentId = role === 'student' ? session.user.id : args.data.studentId;
  if (!studentId) return DATA_NOT_FOUND();

  try {
    const [student] = await getDb()
      .select({ studentId: users.id, studentName: users.name })
      .from(users)
      .where(and(eq(users.id, studentId), eq(users.role, 'student'), isNull(users.deletedAt)))
      .limit(1);
    if (!student) return DATA_NOT_FOUND();
    if (!(await hasAuthorizedScope(session.user.id, role, args.data, studentId))) {
      return DATA_NOT_FOUND();
    }

    const conditions = [
      activeAcademicRecordCondition,
      eq(academicRecords.studentId, studentId),
      ...filterConditions(args.data),
    ];
    const gpaConditions = [
      activeAcademicRecordCondition,
      eq(academicRecords.studentId, studentId),
      ...filterConditions({ ...args.data, termId: null }),
    ];
    const [termGpa, cumulativeGpa] = await Promise.all([
      aggregateAcademicRecordGpa(gpaConditions, {
        termId: args.data.termId ?? undefined,
        latestAttempt: false,
      }),
      aggregateAcademicRecordGpa(gpaConditions, { latestAttempt: true }),
    ]);
    const rows = await getDb()
      .select({
        recordId: academicRecords.id,
        courseCode: courses.code,
        courseName: courses.name,
        sectionCode: courseSections.code,
        termCode: academicTerms.code,
        termName: academicTerms.name,
        status: academicRecords.status,
        numericScore: academicRecords.numericScore,
        letterGrade: academicRecords.letterGrade,
        credits: academicRecords.credits,
        gradePoints: academicRecords.gradePoints,
        publishedAt: academicRecords.publishedAt,
      })
      .from(academicRecords)
      .innerJoin(courses, eq(courses.id, academicRecords.courseId))
      .innerJoin(courseSections, eq(courseSections.id, academicRecords.courseSectionId))
      .innerJoin(academicTerms, eq(academicTerms.id, academicRecords.termId))
      .where(and(...conditions))
      .orderBy(desc(academicTerms.startDate), asc(courses.code), desc(academicRecords.id))
      .limit(MAX_TRANSCRIPT_RECORDS);

    return {
      filters: {
        termId: args.data.termId,
        courseId: args.data.courseId,
        sectionId: args.data.sectionId,
        cohort: args.data.cohort,
      },
      student: { id: student.studentId, name: student.studentName },
      termGpa,
      cumulativeGpa,
      records: rows.map((row) => ({
        ...row,
        numericScore: row.numericScore === null ? null : Number(row.numericScore),
        credits: Number(row.credits),
        gradePoints: row.gradePoints === null ? null : Number(row.gradePoints),
      })),
    };
  } catch (error) {
    return internalError(error, 'getOfficialTranscriptHandler');
  }
}
