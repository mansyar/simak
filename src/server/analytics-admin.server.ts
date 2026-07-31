// Server-only handler for admin analytics data
import { and, sql, gte, lte, asc, eq, inArray } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { getDb } from '@/db/index';
import { checkpoints } from '@/db/schema/assignments';
import { submissions, reviews } from '@/db/schema/submissions';
import { consultations } from '@/db/schema/consultations';
import { auditLog } from '@/db/schema/audit-log';
import { reviewScores } from '@/db/schema/rubrics';
import { finalGrades } from '@/db/schema/gradebook';
import { getSessionFromHeaders } from './auth';
import { serverError, ErrorCode } from '@/lib/errors';
import { isAdmin } from '@/lib/session-guards';

type AnalyticsDateRangeInput = {
  range?: '7d' | '30d' | '90d' | 'all';
  start?: Date;
  end?: Date;
};

export type AdminAnalyticsData = {
  consultationVerificationRate: number;
  deadlineBreachRate: number;
  statusDistribution: { state: string; count: number }[];
  submissionTrend: { date: string; count: number }[];
  reviewTrend: { date: string; count: number }[];
  reviewsCompleted: number;
  dauTrend: { date: string; activeUsers: number }[];
  wauTrend: { date: string; activeUsers: number }[];
  dateRange: { start: string | null; end: string | null };
  gradeDistribution: { A: number; B: number; C: number; D: number; F: number };
  atRiskSummary: { high: number; medium: number; low: number };
};

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

export async function getAdminAnalyticsDataHandler({ data }: { data: AnalyticsDateRangeInput }) {
  const session = await getSessionFromHeaders();
  if (!isAdmin(session)) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const { startDate, endDate } = resolveDateRange(data);
  const db = getDb();

  try {
    const [
      [consultationStats],
      [deadlineStats],
      statusDistribution,
      submissionTrend,
      reviewTrend,
      [reviewCount],
      dauTrend,
      wauTrend,
      gradeDistributionRows,
    ] = await Promise.all([
      // 1. Consultation verification rate
      db
        .select({
          total: sql<number>`count(*)::int`,
          verified: sql<number>`count(*) FILTER (WHERE ${consultations.status} = 'verified')::int`,
        })
        .from(consultations)
        .where(dateCondition(consultations.createdAt, startDate, endDate)),

      // 2. Deadline breach rate
      db
        .select({
          total: sql<number>`count(*)::int`,
          breached: sql<number>`count(*) FILTER (WHERE ${checkpoints.dueDate} < now() AND ${checkpoints.state} != 'passed')::int`,
        })
        .from(checkpoints)
        .where(dateCondition(checkpoints.createdAt, startDate, endDate)),

      // 3. Assignment status distribution
      db
        .select({
          state: checkpoints.state,
          count: sql<number>`count(*)::int`,
        })
        .from(checkpoints)
        .where(dateCondition(checkpoints.createdAt, startDate, endDate))
        .groupBy(checkpoints.state),

      // 4. Submission volume over time (daily)
      db
        .select({
          date: sql<string>`date_trunc('day', ${submissions.uploadedAt})::date::text`,
          count: sql<number>`count(*)::int`,
        })
        .from(submissions)
        .where(dateCondition(submissions.uploadedAt, startDate, endDate))
        .groupBy(sql`date_trunc('day', ${submissions.uploadedAt})`)
        .orderBy(sql`date_trunc('day', ${submissions.uploadedAt})`),

      // 5. Review volume over time (daily)
      db
        .select({
          date: sql<string>`date_trunc('day', ${reviews.createdAt})::date::text`,
          count: sql<number>`count(*)::int`,
        })
        .from(reviews)
        .where(dateCondition(reviews.createdAt, startDate, endDate))
        .groupBy(sql`date_trunc('day', ${reviews.createdAt})`)
        .orderBy(sql`date_trunc('day', ${reviews.createdAt})`),

      // 6. Reviews completed count
      db
        .select({
          count: sql<number>`count(*)::int`,
        })
        .from(reviews)
        .where(
          and(
            sql`${reviews.reviewedAt} IS NOT NULL`,
            dateCondition(reviews.reviewedAt, startDate, endDate),
          ),
        ),

      // 7. DAU trend
      db
        .select({
          date: sql<string>`date_trunc('day', ${auditLog.createdAt})::date::text`,
          activeUsers: sql<number>`count(DISTINCT ${auditLog.actorId})::int`,
        })
        .from(auditLog)
        .where(dateCondition(auditLog.createdAt, startDate, endDate))
        .groupBy(sql`date_trunc('day', ${auditLog.createdAt})`)
        .orderBy(sql`date_trunc('day', ${auditLog.createdAt})`),

      // 8. WAU trend
      db
        .select({
          date: sql<string>`date_trunc('week', ${auditLog.createdAt})::date::text`,
          activeUsers: sql<number>`count(DISTINCT ${auditLog.actorId})::int`,
        })
        .from(auditLog)
        .where(dateCondition(auditLog.createdAt, startDate, endDate))
        .groupBy(sql`date_trunc('week', ${auditLog.createdAt})`)
        .orderBy(sql`date_trunc('week', ${auditLog.createdAt})`),

      // 9. Grade distribution (letter grade counts from final_grades)
      db
        .select({
          letterGrade: finalGrades.letterGrade,
          count: sql<number>`count(*)::int`,
        })
        .from(finalGrades)
        .where(sql`${finalGrades.letterGrade} IS NOT NULL`)
        .groupBy(finalGrades.letterGrade),
    ]);

    const consultationVerificationRate =
      consultationStats.total > 0
        ? Math.round((consultationStats.verified / consultationStats.total) * 100)
        : 0;

    const deadlineBreachRate =
      deadlineStats.total > 0
        ? Math.round((deadlineStats.breached / deadlineStats.total) * 100)
        : 0;

    // Use aliases so correlated subqueries keep their columns unambiguous.
    const riskCheckpoints = alias(checkpoints, 'risk_checkpoints');
    const riskSubmissions = alias(submissions, 'risk_submissions');
    const riskConsultations = alias(consultations, 'risk_consultations');
    const riskReviews = alias(reviews, 'risk_reviews');

    // At-risk student summary (simplified SQL counting distinct students per signal)
    const [atRiskRow] = await db
      .select({
        high: sql<number>`count(DISTINCT CASE WHEN ${riskCheckpoints.state} IN ('unlocked','revise') AND ${riskCheckpoints.dueDate} < now() THEN ${riskCheckpoints.studentId} END)::int`,
        medium: sql<number>`count(DISTINCT CASE WHEN (
          (${riskCheckpoints.state} = 'unlocked' AND ${riskCheckpoints.dueDate} > now() AND ${riskCheckpoints.dueDate} <= now() + interval '3 days'
           AND NOT EXISTS (SELECT 1 FROM ${submissions} AS ${riskSubmissions} WHERE ${riskSubmissions.checkpointId} = ${riskCheckpoints.id}))
          OR (${riskCheckpoints.dueDate} <= now() + interval '7 days'
               AND COALESCE((SELECT count(*) FROM ${consultations} AS ${riskConsultations} WHERE ${riskConsultations.checkpointId} = ${riskCheckpoints.id} AND ${riskConsultations.status} = 'verified'), 0) < COALESCE(${riskCheckpoints.minConsultations}, 0))
          OR (SELECT count(*) FROM ${reviews} AS ${riskReviews} JOIN ${submissions} AS ${riskSubmissions} ON ${riskSubmissions.id} = ${riskReviews.submissionId} WHERE ${riskSubmissions.checkpointId} = ${riskCheckpoints.id} AND ${riskReviews.decision} = 'revise') >= 2
        ) THEN ${riskCheckpoints.studentId} END)::int`,
        low: sql<number>`count(DISTINCT CASE WHEN ${riskCheckpoints.state} = 'under_review' AND EXISTS (SELECT 1 FROM ${submissions} AS ${riskSubmissions} WHERE ${riskSubmissions.checkpointId} = ${riskCheckpoints.id} AND ${riskSubmissions.uploadedAt} < now() - interval '3 days') THEN ${riskCheckpoints.studentId} END)::int`,
      })
      .from(riskCheckpoints)
      .where(inArray(riskCheckpoints.state, ['unlocked', 'revise', 'under_review', 'submitted']));

    return {
      consultationVerificationRate,
      deadlineBreachRate,
      statusDistribution: statusDistribution.map((s) => ({
        state: s.state,
        count: Number(s.count),
      })),
      submissionTrend: submissionTrend.map((s) => ({
        date: s.date,
        count: Number(s.count),
      })),
      reviewTrend: reviewTrend.map((r) => ({
        date: r.date,
        count: Number(r.count),
      })),
      reviewsCompleted: Number(reviewCount.count),
      dauTrend: dauTrend.map((d) => ({
        date: d.date,
        activeUsers: Number(d.activeUsers),
      })),
      wauTrend: wauTrend.map((w) => ({
        date: w.date,
        activeUsers: Number(w.activeUsers),
      })),
      dateRange: {
        start: startDate ? startDate.toISOString() : null,
        end: endDate ? endDate.toISOString() : null,
      },
      gradeDistribution: {
        A: Number(gradeDistributionRows.find((g) => g.letterGrade === 'A')?.count ?? 0),
        B: Number(gradeDistributionRows.find((g) => g.letterGrade === 'B')?.count ?? 0),
        C: Number(gradeDistributionRows.find((g) => g.letterGrade === 'C')?.count ?? 0),
        D: Number(gradeDistributionRows.find((g) => g.letterGrade === 'D')?.count ?? 0),
        F: Number(gradeDistributionRows.find((g) => g.letterGrade === 'F')?.count ?? 0),
      },
      atRiskSummary: {
        high: Number(atRiskRow?.high ?? 0),
        medium: Number(atRiskRow?.medium ?? 0),
        low: Number(atRiskRow?.low ?? 0),
      },
    };
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'getAdminAnalyticsDataHandler',
    });
  }
}

export type AdminRubricAnalytics = {
  criteria: Array<{
    criterionId: number;
    criterionTitle: string;
    avgScore: number;
    passRate: number;
    reviewCount: number;
  }>;
  dateRange: { start: string | null; end: string | null };
};

export async function getAdminRubricAnalyticsHandler({ data }: { data: AnalyticsDateRangeInput }) {
  const session = await getSessionFromHeaders();
  if (!isAdmin(session)) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

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
          sql`${reviews.reviewedAt} IS NOT NULL`,
          dateCondition(reviews.reviewedAt, startDate, endDate),
        ),
      )
      .groupBy(reviewScores.criterionId, reviewScores.criterionTitle)
      .orderBy(asc(sql`AVG(${reviewScores.score})`));

    return {
      criteria: result.map((row) => ({
        criterionId: row.criterionId,
        criterionTitle: row.criterionTitle,
        avgScore: Math.round(row.avgScore * 10) / 10,
        passRate: Math.round(row.passRate * 10) / 10,
        reviewCount: Number(row.reviewCount),
      })),
      dateRange: {
        start: startDate ? startDate.toISOString() : null,
        end: endDate ? endDate.toISOString() : null,
      },
    };
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'getAdminRubricAnalyticsHandler',
    });
  }
}
