import { and, asc, desc, eq, sql, type SQL } from 'drizzle-orm';
import { getDb } from '@/db/index';
import { academicRecordPolicies, academicRecords } from '@/db/schema/academic-records';
import {
  academicTerms,
  courseSections,
  courses,
  sectionEnrollments,
} from '@/db/schema/academic-context';
import { users } from '@/db/schema/users';
import { getSessionFromHeaders } from './auth';
import type {
  GetAdminAcademicRecordsInput,
  GetInstructorAcademicRecordsInput,
  GetStudentAcademicRecordsInput,
} from './academic-records';
import { isAdmin, isInstructor, isStudent } from '@/lib/session-guards';
import { ErrorCode, serverError, type ServerError } from '@/lib/errors';
import type { GpaCalculation } from '@/lib/academic-record-policy';

const recordProjection = {
  recordId: academicRecords.id,
  studentId: academicRecords.studentId,
  studentName: users.name,
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
  studentName: string;
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
  sourceReleaseVersion: number;
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

export const activeAcademicRecordCondition = sql`NOT EXISTS (
  SELECT 1
  FROM academic_records newer
  WHERE newer.student_id = ${academicRecords.studentId}
    AND newer.course_section_id = ${academicRecords.courseSectionId}
    AND (
      newer.source_release_version > ${academicRecords.sourceReleaseVersion}
      OR (
        newer.source_release_version = ${academicRecords.sourceReleaseVersion}
        AND newer.published_at > ${academicRecords.publishedAt}
      )
      OR (
        newer.source_release_version = ${academicRecords.sourceReleaseVersion}
        AND newer.published_at = ${academicRecords.publishedAt}
        AND newer.id > ${academicRecords.id}
      )
    )
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

type AggregateRow = {
  gpa: number | string | null;
  totalCredits: number | string | null;
  totalQualityPoints: number | string | null;
  eligibleRecordIds: number[] | null;
};

export async function aggregateAcademicRecordGpa(
  conditions: SQL[],
  options: { termId?: number; latestAttempt: boolean },
): Promise<GpaCalculation | null> {
  if (options.termId === undefined && !options.latestAttempt) return null;
  const termCondition = options.termId
    ? sql`AND ${academicRecords.termId} = ${options.termId}`
    : sql``;
  const latestFilter = options.latestAttempt ? sql`WHERE attempt_rank = 1` : sql``;
  const rows = (await getDb().execute(sql`
    WITH eligible AS (
      SELECT
        ${academicRecords.id} AS record_id,
        ${academicRecords.credits} AS credits,
        ${academicRecords.gradePoints} AS grade_points,
        ${academicRecordPolicies.roundingScale} AS rounding_scale,
        ${academicRecordPolicies.version} AS policy_version,
        ${academicRecordPolicies.id} AS policy_id,
        ${academicTerms.startDate} AS term_start_date,
        row_number() OVER (
          PARTITION BY ${academicRecords.courseId}
          ORDER BY ${academicTerms.startDate} DESC, ${academicRecords.termId} DESC,
            ${academicRecords.publishedAt} DESC, ${academicRecords.id} DESC
        ) AS attempt_rank
      FROM ${academicRecords}
      INNER JOIN ${academicTerms} ON ${academicRecords.termId} = ${academicTerms.id}
      INNER JOIN ${courseSections}
        ON ${academicRecords.courseSectionId} = ${courseSections.id}
      INNER JOIN ${academicRecordPolicies}
        ON ${academicRecords.policyVersion} = ${academicRecordPolicies.version}
      WHERE ${and(...conditions)}
        AND ${academicRecords.status} = 'complete'
        AND ${academicRecords.gradePoints} IS NOT NULL
        ${termCondition}
    )
    SELECT
      round(
        sum(credits * grade_points) / NULLIF(sum(credits), 0),
        COALESCE((array_agg(rounding_scale ORDER BY term_start_date DESC,
          policy_version DESC, policy_id DESC, record_id DESC))[1], 2)
      ) AS gpa,
      sum(credits) AS "totalCredits",
      sum(credits * grade_points) AS "totalQualityPoints",
      array_agg(record_id ORDER BY record_id) AS "eligibleRecordIds"
    FROM eligible
    ${latestFilter}
  `)) as unknown as AggregateRow[];
  const row = rows[0];
  if (!row) return null;
  return {
    gpa: row.gpa === null ? null : Number(row.gpa),
    totalCredits: Number(row.totalCredits ?? 0),
    totalQualityPoints: Number(row.totalQualityPoints ?? 0),
    eligibleRecordIds: row.eligibleRecordIds ?? [],
  };
}

async function queryRecords(options: QueryOptions): Promise<AcademicRecordsResponse> {
  const baseConditions: SQL[] = [activeAcademicRecordCondition];
  if (options.studentId) baseConditions.push(eq(academicRecords.studentId, options.studentId));
  if (options.sectionId)
    baseConditions.push(eq(academicRecords.courseSectionId, options.sectionId));
  if (options.status) baseConditions.push(eq(academicRecords.status, options.status));
  const displayConditions = options.termId
    ? [...baseConditions, eq(academicRecords.termId, options.termId)]
    : baseConditions;

  const [rows, [{ count }], terms, termGpa, cumulativeGpa] = await Promise.all([
    getDb()
      .select(recordProjection)
      .from(academicRecords)
      .innerJoin(users, eq(academicRecords.studentId, users.id))
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
      .select({ id: academicTerms.id, code: academicTerms.code, name: academicTerms.name })
      .from(academicRecords)
      .innerJoin(academicTerms, eq(academicRecords.termId, academicTerms.id))
      .where(and(...baseConditions))
      .groupBy(academicTerms.id, academicTerms.code, academicTerms.name, academicTerms.startDate)
      .orderBy(desc(academicTerms.startDate), desc(academicTerms.id))
      .limit(500),
    aggregateAcademicRecordGpa(baseConditions, {
      termId: options.termId,
      latestAttempt: false,
    }),
    aggregateAcademicRecordGpa(baseConditions, { latestAttempt: true }),
  ]);

  const normalizedRows = (rows as AcademicRecordRow[]).map(normalizeRecord);

  return {
    records: normalizedRows,
    terms,
    page: options.page,
    limit: options.limit,
    total: Number(count),
    termGpa,
    cumulativeGpa,
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
