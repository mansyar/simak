import { and, asc, eq, ne } from 'drizzle-orm';
import { getDb } from '@/db/index';
import {
  academicTerms,
  courses,
  courseSections,
  sectionEnrollments,
} from '@/db/schema/academic-context';
import { ErrorCode, serverError } from '@/lib/errors';
import { getAvailableReportTypes, type ReportingRole } from '@/lib/reporting-policy';
import { getSessionFromHeaders } from '@/server/auth';

const filterProjection = {
  termId: academicTerms.id,
  termCode: academicTerms.code,
  termName: academicTerms.name,
  courseId: courses.id,
  courseCode: courses.code,
  courseName: courses.name,
  sectionId: courseSections.id,
  sectionCode: courseSections.code,
  sectionName: courseSections.name,
  cohort: courseSections.cohort,
};

type FilterRow = {
  termId: number;
  termCode: string;
  termName: string;
  courseId: number;
  courseCode: string;
  courseName: string;
  sectionId: number;
  sectionCode: string;
  sectionName: string | null;
  cohort: string | null;
};

function uniqueById<T extends { id: number }>(values: T[]): T[] {
  return [...new Map(values.map((value) => [value.id, value])).values()];
}

export function buildReportFilterOptions(rows: FilterRow[]) {
  return {
    terms: uniqueById(
      rows.map((row) => ({ id: row.termId, code: row.termCode, name: row.termName })),
    ),
    courses: uniqueById(
      rows.map((row) => ({ id: row.courseId, code: row.courseCode, name: row.courseName })),
    ),
    sections: uniqueById(
      rows.map((row) => ({
        id: row.sectionId,
        code: row.sectionCode,
        name: row.sectionName,
        cohort: row.cohort,
      })),
    ),
    cohorts: [
      ...new Set(rows.map((row) => row.cohort).filter((value): value is string => !!value)),
    ],
  };
}

async function listAuthorizedFilterRows(userId: string, role: ReportingRole): Promise<FilterRow[]> {
  const db = getDb();
  const baseConditions = [ne(courseSections.status, 'archived')];

  if (role === 'superadmin' || role === 'admin') {
    return db
      .select(filterProjection)
      .from(courseSections)
      .innerJoin(academicTerms, eq(academicTerms.id, courseSections.termId))
      .innerJoin(courses, eq(courses.id, courseSections.courseId))
      .where(and(...baseConditions))
      .orderBy(asc(academicTerms.startDate), asc(courses.code), asc(courseSections.code));
  }

  return db
    .select(filterProjection)
    .from(courseSections)
    .innerJoin(academicTerms, eq(academicTerms.id, courseSections.termId))
    .innerJoin(courses, eq(courses.id, courseSections.courseId))
    .innerJoin(
      sectionEnrollments,
      and(
        eq(sectionEnrollments.sectionId, courseSections.id),
        eq(sectionEnrollments.userId, userId),
        eq(sectionEnrollments.role, role),
        eq(sectionEnrollments.isActive, true),
      ),
    )
    .where(and(...baseConditions))
    .orderBy(asc(academicTerms.startDate), asc(courses.code), asc(courseSections.code));
}

export async function getReportCatalogHandler(_args: { data: Record<string, never> }) {
  const session = await getSessionFromHeaders();
  if (!session) return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');

  const role = session.user.role as ReportingRole;
  if (!['superadmin', 'admin', 'instructor', 'student'].includes(role)) {
    return serverError(ErrorCode.FORBIDDEN, 'Forbidden');
  }

  try {
    const rows = await listAuthorizedFilterRows(session.user.id, role);
    return { reports: getAvailableReportTypes(role), filters: buildReportFilterOptions(rows) };
  } catch (error) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: error instanceof Error ? error.message : String(error),
      handler: 'getReportCatalogHandler',
    });
  }
}
