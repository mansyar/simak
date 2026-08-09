import { and, asc, desc, eq, sql, type SQL } from 'drizzle-orm';
import { getDb } from '@/db/index';
import { academicRecordPolicies, academicRecords } from '@/db/schema/academic-records';
import {
  academicTerms,
  courseSections,
  courses,
  sectionEnrollments,
} from '@/db/schema/academic-context';
import { getSessionFromHeaders } from './auth';
import type {
  GetAdminAcademicRecordsInput,
  GetInstructorAcademicRecordsInput,
  GetStudentAcademicRecordsInput,
} from './academic-records';
import { isAdmin, isInstructor, isStudent } from '@/lib/session-guards';
import { ErrorCode, serverError, type ServerError } from '@/lib/errors';
import {
  calculateCumulativeGpa,
  calculateTermGpa,
  DEFAULT_ACADEMIC_RECORD_POLICY,
  type AcademicRecord,
  type GpaCalculation,
} from '@/lib/academic-record-policy';

const recordProjection = {
  recordId: academicRecords.id,
  studentId: academicRecords.studentId,
  courseId: academicRecords.courseId,
  courseCode: courses.code,
  courseName: courses.name,
  courseSectionId: academicRecords.courseSectionId,
  sectionCode: courseSections.code,
  termId: academicRecords.termId,
  termCode: academicTerms.code,
  termName: academicTerms.name,
  termStartDate: academicTerms.startDate,
  sourceAssignmentId: academicRecords.sourceAssignmentId,
  sourceSnapshotId: academicRecords.sourceSnapshotId,
  sourceReleaseVersion: academicRecords.sourceReleaseVersion,
  policyVersion: academicRecords.policyVersion,
  recordVersion: academicRecords.recordVersion,
  numericScore: academicRecords.numericScore,
  letterGrade: academicRecords.letterGrade,
  status: academicRecords.status,
  credits: academicRecords.credits,
  gradePoints: academicRecords.gradePoints,
  roundingScale: academicRecordPolicies.roundingScale,
  publishedAt: academicRecords.publishedAt,
  createdAt: academicRecords.createdAt,
};

type AcademicRecordRow = {
  recordId: number;
  studentId: string;
  courseId: number;
  courseCode: string;
  courseName: string;
  courseSectionId: number;
  sectionCode: string;
  termId: number;
  termCode: string;
  termName: string;
  termStartDate: string;
  sourceAssignmentId: number;
  sourceSnapshotId: number | null;
  sourceReleaseVersion: number | null;
  policyVersion: number;
  recordVersion: number;
  numericScore: string | number | null;
  letterGrade: string | null;
  status: 'complete' | 'incomplete' | 'withdrawn';
  credits: string | number;
  gradePoints: string | number | null;
  roundingScale: number | null;
  publishedAt: Date | string | null;
  createdAt: Date | string;
};

type QueryOptions = {
  studentId?: string;
  sectionId?: number;
  termId?: number;
  status?: 'complete' | 'incomplete' | 'withdrawn';
  page: number;
  limit: number;
};

type AcademicRecordsResponse = {
  records: AcademicRecordRow[];
  terms: Array<{ id: number; code: string; name: string }>;
  page: number;
  limit: number;
  total: number;
  termGpa: GpaCalculation | null;
  cumulativeGpa: GpaCalculation | null;
};

const activeRecordCondition = sql`NOT EXISTS (
  SELECT 1
  FROM academic_records newer
  WHERE newer.student_id = ${academicRecords.studentId}
    AND newer.course_section_id = ${academicRecords.courseSectionId}
    AND newer.record_version > ${academicRecords.recordVersion}
)`;

function requireSession(
  session: Awaited<ReturnType<typeof getSessionFromHeaders>>,
  role: 'student' | 'instructor' | 'admin',
): ServerError | NonNullable<typeof session> {
  if (!session) return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');

  const authorized =
    role === 'student'
      ? isStudent(session)
      : role === 'instructor'
        ? isInstructor(session)
        : isAdmin(session);
  return authorized ? session : serverError(ErrorCode.FORBIDDEN, 'Forbidden');
}

function normalizeRecord(row: AcademicRecordRow): AcademicRecordRow {
  return {
    ...row,
    numericScore: row.numericScore === null ? null : Number(row.numericScore),
    credits: Number(row.credits),
    gradePoints: row.gradePoints === null ? null : Number(row.gradePoints),
  };
}

function toPolicyRecord(row: AcademicRecordRow): AcademicRecord {
  return {
    id: row.recordId,
    courseId: row.courseId,
    termId: row.termId,
    termStartDate: row.termStartDate,
    publishedAt: row.publishedAt ?? row.createdAt,
    status: row.status,
    letterGrade: row.letterGrade,
    credits: Number(row.credits),
    gradePoints: row.gradePoints === null ? null : Number(row.gradePoints),
  };
}

function roundingScale(rows: AcademicRecordRow[]): number {
  const scale = rows.find((row) => row.roundingScale !== null)?.roundingScale;
  return scale ?? DEFAULT_ACADEMIC_RECORD_POLICY.roundingScale;
}

async function queryRecords(options: QueryOptions): Promise<AcademicRecordsResponse> {
  const baseConditions: SQL[] = [activeRecordCondition];
  if (options.studentId) baseConditions.push(eq(academicRecords.studentId, options.studentId));
  if (options.sectionId)
    baseConditions.push(eq(academicRecords.courseSectionId, options.sectionId));
  if (options.status) baseConditions.push(eq(academicRecords.status, options.status));
  const displayConditions = options.termId
    ? [...baseConditions, eq(academicRecords.termId, options.termId)]
    : baseConditions;

  const [rows, [{ count }], allRows] = await Promise.all([
    getDb()
      .select(recordProjection)
      .from(academicRecords)
      .innerJoin(courses, eq(academicRecords.courseId, courses.id))
      .innerJoin(courseSections, eq(academicRecords.courseSectionId, courseSections.id))
      .innerJoin(academicTerms, eq(academicRecords.termId, academicTerms.id))
      .innerJoin(
        academicRecordPolicies,
        eq(academicRecords.policyVersion, academicRecordPolicies.version),
      )
      .where(and(...displayConditions))
      .orderBy(desc(academicTerms.startDate), asc(courses.code), desc(academicRecords.id))
      .limit(options.limit)
      .offset((options.page - 1) * options.limit),
    getDb()
      .select({ count: sql<number>`count(*)::int` })
      .from(academicRecords)
      .where(and(...displayConditions)),
    getDb()
      .select(recordProjection)
      .from(academicRecords)
      .innerJoin(courses, eq(academicRecords.courseId, courses.id))
      .innerJoin(courseSections, eq(academicRecords.courseSectionId, courseSections.id))
      .innerJoin(academicTerms, eq(academicRecords.termId, academicTerms.id))
      .innerJoin(
        academicRecordPolicies,
        eq(academicRecords.policyVersion, academicRecordPolicies.version),
      )
      .where(and(...baseConditions)),
  ]);

  const normalizedRows = (rows as AcademicRecordRow[]).map(normalizeRecord);
  const normalizedAllRows = (allRows as AcademicRecordRow[]).map(normalizeRecord);
  const policy = {
    gradePoints: DEFAULT_ACADEMIC_RECORD_POLICY.gradePoints,
    roundingScale: roundingScale(normalizedAllRows),
  };
  const policyRecords = normalizedAllRows.map(toPolicyRecord);
  const terms = Array.from(
    new Map(
      normalizedAllRows.map((row) => [
        row.termId,
        { id: row.termId, code: row.termCode, name: row.termName },
      ]),
    ).values(),
  );
  const termRecords = options.termId
    ? calculateTermGpa(policyRecords, options.termId, policy)
    : null;

  return {
    records: normalizedRows,
    terms,
    page: options.page,
    limit: options.limit,
    total: Number(count),
    termGpa: termRecords,
    cumulativeGpa: calculateCumulativeGpa(policyRecords, policy),
  };
}

export async function getStudentAcademicRecordsHandler(args: {
  data: GetStudentAcademicRecordsInput;
}) {
  const authorization = requireSession(await getSessionFromHeaders(), 'student');
  if ('error' in authorization) return authorization;

  try {
    return await queryRecords({ ...args.data, studentId: authorization.user.id });
  } catch (error) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: error,
      handler: 'getStudentAcademicRecordsHandler',
    });
  }
}

export async function getInstructorAcademicRecordsHandler(args: {
  data: GetInstructorAcademicRecordsInput;
}) {
  const authorization = requireSession(await getSessionFromHeaders(), 'instructor');
  if ('error' in authorization) return authorization;

  try {
    const [enrollment] = await getDb()
      .select({ sectionId: sectionEnrollments.sectionId })
      .from(sectionEnrollments)
      .where(
        and(
          eq(sectionEnrollments.sectionId, args.data.sectionId),
          eq(sectionEnrollments.userId, authorization.user.id),
          eq(sectionEnrollments.role, 'instructor'),
          eq(sectionEnrollments.isActive, true),
        ),
      )
      .limit(1);
    if (!enrollment) return serverError(ErrorCode.FORBIDDEN, 'Forbidden');

    return await queryRecords({ ...args.data, page: args.data.page, limit: args.data.limit });
  } catch (error) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: error,
      handler: 'getInstructorAcademicRecordsHandler',
    });
  }
}

export async function getAdminAcademicRecordsHandler(args: { data: GetAdminAcademicRecordsInput }) {
  const authorization = requireSession(await getSessionFromHeaders(), 'admin');
  if ('error' in authorization) return authorization;

  try {
    return await queryRecords(args.data);
  } catch (error) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: error,
      handler: 'getAdminAcademicRecordsHandler',
    });
  }
}
