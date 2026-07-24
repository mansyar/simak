// Server-only handler for instructor analytics data
import { and, eq, isNull, sql, gte, lte } from 'drizzle-orm';
import { getDb } from '@/db/index';
import { assignments, assignmentStudents } from '@/db/schema/assignments';
import { submissions, reviews } from '@/db/schema/submissions';
import { reviewScores } from '@/db/schema/rubrics';
import { getSessionFromHeaders } from './auth';
import { serverError, ErrorCode } from '@/lib/errors';
import type { NonNullableSession } from '@/lib/types';

type AnalyticsDateRangeInput = {
  range?: '7d' | '30d' | '90d' | 'all';
  start?: Date;
  end?: Date;
};

export type InstructorAnalyticsData = {
  reviewsCompleted: number;
  averageResponseTimeHours: number | null;
  slaBreachCount: number;
  studentsSupervised: number;
  assignmentsActive: number;
  dateRange: { start: string | null; end: string | null };
};

function isInstructor(session: NonNullableSession | null): session is NonNullableSession {
  return !!session && session.user.role === 'instructor';
}

function resolveDateRange(data: AnalyticsDateRangeInput): {
  startDate: Date | null;
  endDate: Date | null;
} {
  const now = new Date();

  if (data.start && data.end) {
    return { startDate: data.start, endDate: data.end };
  }

  switch (data.range) {
    case '7d':
      return { startDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), endDate: now };
    case '30d':
      return { startDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), endDate: now };
    case '90d':
      return { startDate: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000), endDate: now };
    case 'all':
    default:
      return { startDate: null, endDate: null };
  }
}

function dateCondition(
  column: Parameters<typeof gte>[0],
  startDate: Date | null,
  endDate: Date | null,
) {
  if (!startDate && !endDate) return sql`true`;
  if (startDate && endDate) return and(gte(column, startDate), lte(column, endDate));
  if (startDate) return gte(column, startDate);
  return lte(column, endDate);
}

export async function getInstructorAnalyticsDataHandler({
  data,
}: {
  data: AnalyticsDateRangeInput;
}) {
  const session = await getSessionFromHeaders();
  if (!isInstructor(session)) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const instructorId = session.user.id;
  const { startDate, endDate } = resolveDateRange(data);
  const db = getDb();

  try {
    const [[reviewStats], [studentCount], [assignmentCount]] = await Promise.all([
      // 1. Reviews completed + avg response time + SLA breach count
      db
        .select({
          reviewsCompleted: sql<number>`count(*)::int`,
          avgResponseTimeSeconds: sql<number>`AVG(EXTRACT(EPOCH FROM ${reviews.reviewedAt} - ${submissions.uploadedAt}))::float`,
          slaBreachCount: sql<number>`count(*) FILTER (WHERE EXTRACT(EPOCH FROM ${reviews.reviewedAt} - ${submissions.uploadedAt}) > 259200)::int`,
        })
        .from(reviews)
        .innerJoin(submissions, eq(reviews.submissionId, submissions.id))
        .where(
          and(
            eq(reviews.instructorId, instructorId),
            sql`${reviews.reviewedAt} IS NOT NULL`,
            dateCondition(reviews.reviewedAt, startDate, endDate),
          ),
        ),

      // 2. Students supervised (distinct students across active assignments)
      db
        .select({
          count: sql<number>`count(DISTINCT ${assignmentStudents.studentId})::int`,
        })
        .from(assignmentStudents)
        .innerJoin(assignments, eq(assignmentStudents.assignmentId, assignments.id))
        .where(and(eq(assignments.instructorId, instructorId), isNull(assignments.deletedAt))),

      // 3. Assignments active (non-deleted)
      db
        .select({
          count: sql<number>`count(*)::int`,
        })
        .from(assignments)
        .where(and(eq(assignments.instructorId, instructorId), isNull(assignments.deletedAt))),
    ]);

    const avgResponseTimeHours = reviewStats.avgResponseTimeSeconds
      ? Math.round((Number(reviewStats.avgResponseTimeSeconds) / 3600) * 10) / 10
      : null;

    return {
      reviewsCompleted: Number(reviewStats.reviewsCompleted),
      averageResponseTimeHours: avgResponseTimeHours,
      slaBreachCount: Number(reviewStats.slaBreachCount),
      studentsSupervised: Number(studentCount.count),
      assignmentsActive: Number(assignmentCount.count),
      dateRange: {
        start: startDate ? startDate.toISOString() : null,
        end: endDate ? endDate.toISOString() : null,
      },
    };
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'getInstructorAnalyticsDataHandler',
    });
  }
}

export type InstructorRubricAnalytics = {
  criteria: Array<{
    criterionId: number;
    criterionTitle: string;
    avgScore: number;
    reviewCount: number;
    passRate: number;
  }>;
  dateRange: { start: string | null; end: string | null };
};

export async function getInstructorRubricAnalyticsHandler({
  data,
}: {
  data: AnalyticsDateRangeInput;
}) {
  const session = await getSessionFromHeaders();
  if (!isInstructor(session)) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const instructorId = session.user.id;
  const { startDate, endDate } = resolveDateRange(data);
  const db = getDb();

  try {
    const result = await db
      .select({
        criterionId: reviewScores.criterionId,
        criterionTitle: reviewScores.criterionTitle,
        avgScore: sql<number>`AVG(${reviewScores.score})::float`,
        reviewCount: sql<number>`count(*)::int`,
        passRate: sql<number>`CASE WHEN count(*) > 0 THEN count(*) FILTER (WHERE ${reviews.decision} = 'pass')::float / count(*) * 100 ELSE 0 END`,
      })
      .from(reviewScores)
      .innerJoin(reviews, eq(reviewScores.reviewId, reviews.id))
      .where(
        and(
          eq(reviews.instructorId, instructorId),
          sql`${reviews.reviewedAt} IS NOT NULL`,
          dateCondition(reviews.reviewedAt, startDate, endDate),
        ),
      )
      .groupBy(reviewScores.criterionId, reviewScores.criterionTitle)
      .orderBy(reviewScores.criterionTitle);

    return {
      criteria: result.map((row) => ({
        criterionId: Number(row.criterionId),
        criterionTitle: row.criterionTitle,
        avgScore: Math.round(Number(row.avgScore) * 10) / 10,
        reviewCount: Number(row.reviewCount),
        passRate: Math.round(Number(row.passRate) * 10) / 10,
      })),
      dateRange: {
        start: startDate ? startDate.toISOString() : null,
        end: endDate ? endDate.toISOString() : null,
      },
    };
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'getInstructorRubricAnalyticsHandler',
    });
  }
}
