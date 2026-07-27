// Server-only handler for instructor dashboard data
import { eq, and, desc, sql, inArray, isNull } from 'drizzle-orm';
import { getDb } from '../db/index';
import { assignments, assignmentStudents, checkpoints } from '../db/schema/assignments';
import { submissions, reviews } from '../db/schema/submissions';
import { consultations } from '../db/schema/consultations';
import { users } from '../db/schema/users';
import { getSessionFromHeaders } from './auth';
import { serverError, ErrorCode, type ServerError } from '@/lib/errors';
import { isInstructor } from '@/lib/session-guards';
import {
  computeStudentRisk,
  type RiskLevel,
  type RiskFactor,
  type CheckpointRiskData,
} from '../lib/risk-scoring';

type DashboardAssignmentOverview = {
  id: number;
  title: string;
  finalDeadline: string | null;
  createdAt: string | null;
  studentCount: number;
  pendingReviewCount: number;
  overallProgressPercent: number;
};

type DashboardPendingReviewItem = {
  submissionId: number;
  checkpointName: string;
  assignmentTitle: string;
  studentName: string;
  submittedAt: string | null;
  waitTimeDays: number;
};

type DashboardRecentSubmission = {
  submissionId: number;
  studentName: string;
  assignmentTitle: string;
  checkpointName: string;
  submittedAt: string | null;
  status: string;
};

type AtRiskStudentEntry = {
  studentName: string;
  studentId: string;
  assignmentTitle: string;
  assignmentId: number;
  riskLevel: RiskLevel;
  factors: RiskFactor[];
};

export type InstructorDashboardSuccess = {
  pendingReviewCount: number;
  pendingReviewItems: DashboardPendingReviewItem[];
  recentSubmissions: DashboardRecentSubmission[];
  assignments: DashboardAssignmentOverview[];
  atRiskStudents: AtRiskStudentEntry[];
};

/**
 * Get all data for the instructor dashboard.
 */
export async function getInstructorDashboardDataHandler(): Promise<
  InstructorDashboardSuccess | ServerError
> {
  const session = await getSessionFromHeaders();
  if (!isInstructor(session)) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const db = getDb();
  const instructorId = session.user.id;

  try {
    // Group A (independent): active assignments, recent submissions, assignment overview
    const [instructorAssignments, recentSubmissions, assignmentOverview] = await Promise.all([
      db
        .select({ id: assignments.id })
        .from(assignments)
        .where(and(eq(assignments.instructorId, instructorId), isNull(assignments.deletedAt))),
      db
        .select({
          submissionId: submissions.id,
          studentName: users.name,
          assignmentTitle: assignments.title,
          checkpointName: checkpoints.name,
          submittedAt: submissions.uploadedAt,
          checkpointState: checkpoints.state,
        })
        .from(submissions)
        .innerJoin(checkpoints, eq(submissions.checkpointId, checkpoints.id))
        .innerJoin(assignments, eq(checkpoints.assignmentId, assignments.id))
        .innerJoin(users, eq(checkpoints.studentId, users.id))
        .where(and(eq(assignments.instructorId, instructorId), isNull(assignments.deletedAt)))
        .orderBy(desc(submissions.uploadedAt))
        .limit(5),
      db
        .select({
          id: assignments.id,
          title: assignments.title,
          finalDeadline: assignments.finalDeadline,
          createdAt: assignments.createdAt,
        })
        .from(assignments)
        .where(and(eq(assignments.instructorId, instructorId), isNull(assignments.deletedAt)))
        .orderBy(desc(assignments.createdAt))
        .limit(20),
    ]);

    const assignmentIds = instructorAssignments.map((a) => a.id);
    let pendingReviewCount = 0;
    let pendingReviewItems: {
      submissionId: number;
      checkpointId: number;
      checkpointName: string;
      assignmentTitle: string;
      studentName: string;
      submittedAt: Date | null;
    }[] = [];

    if (assignmentIds.length > 0) {
      // Group B (depends on Group A assignmentIds): count + FIFO list
      const [{ count }, rawPendingReviewItems] = await Promise.all([
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(checkpoints)
          .where(
            and(
              inArray(checkpoints.assignmentId, assignmentIds),
              sql`${checkpoints.state} IN ('submitted', 'under_review')`,
            ),
          )
          .then((rows) => rows[0]),
        db
          .select({
            submissionId: submissions.id,
            checkpointId: checkpoints.id,
            checkpointName: checkpoints.name,
            assignmentTitle: assignments.title,
            studentName: users.name,
            submittedAt: submissions.uploadedAt,
          })
          .from(submissions)
          .innerJoin(checkpoints, eq(submissions.checkpointId, checkpoints.id))
          .innerJoin(assignments, eq(checkpoints.assignmentId, assignments.id))
          .innerJoin(users, eq(checkpoints.studentId, users.id))
          .where(
            and(
              inArray(checkpoints.assignmentId, assignmentIds),
              sql`${checkpoints.state} IN ('submitted', 'under_review')`,
            ),
          )
          .orderBy(submissions.uploadedAt)
          .limit(50),
      ]);
      pendingReviewCount = Number(count);

      pendingReviewItems = rawPendingReviewItems;

      // Deduplicate: keep only the latest submission per checkpoint
      const seenCheckpoints = new Set<number>();
      pendingReviewItems = pendingReviewItems
        .reverse()
        .filter((item) => {
          if (seenCheckpoints.has(item.checkpointId)) return false;
          seenCheckpoints.add(item.checkpointId);
          return true;
        })
        .reverse();
    }

    const overviewIds = assignmentOverview.map((a) => a.id);
    let studentCountMap = new Map<number, number>();
    let pendingReviewCountMap = new Map<number, number>();
    let progressMap = new Map<number, number>();

    if (overviewIds.length > 0) {
      // Group C (depends on Group A overviewIds): student count, pending review count, progress
      const [counts, pendingCounts, progressData] = await Promise.all([
        db
          .select({
            assignmentId: assignmentStudents.assignmentId,
            count: sql<number>`count(*)::int`,
          })
          .from(assignmentStudents)
          .where(inArray(assignmentStudents.assignmentId, overviewIds))
          .groupBy(assignmentStudents.assignmentId),
        db
          .select({ assignmentId: checkpoints.assignmentId, count: sql<number>`count(*)::int` })
          .from(checkpoints)
          .where(
            and(
              inArray(checkpoints.assignmentId, overviewIds),
              sql`${checkpoints.state} IN ('submitted', 'under_review')`,
            ),
          )
          .groupBy(checkpoints.assignmentId),
        db
          .select({
            assignmentId: checkpoints.assignmentId,
            totalCount: sql<number>`count(*)::int`,
            passedCount: sql<number>`count(*) FILTER (WHERE ${checkpoints.state} = 'passed')::int`,
          })
          .from(checkpoints)
          .where(inArray(checkpoints.assignmentId, overviewIds))
          .groupBy(checkpoints.assignmentId),
      ]);
      studentCountMap = new Map(counts.map((c) => [c.assignmentId, c.count]));
      pendingReviewCountMap = new Map(pendingCounts.map((c) => [c.assignmentId, c.count]));
      progressMap = new Map(
        progressData.map((p) => [
          p.assignmentId,
          p.totalCount > 0 ? Math.round((p.passedCount / p.totalCount) * 100) : 0,
        ]),
      );
    }

    const assignmentsWithDetails: DashboardAssignmentOverview[] = assignmentOverview.map((a) => ({
      id: a.id,
      title: a.title,
      finalDeadline: a.finalDeadline ? a.finalDeadline.toISOString() : null,
      createdAt: a.createdAt ? a.createdAt.toISOString() : null,
      studentCount: studentCountMap.get(a.id) ?? 0,
      pendingReviewCount: pendingReviewCountMap.get(a.id) ?? 0,
      overallProgressPercent: progressMap.get(a.id) ?? 0,
    }));

    // At-risk students (depends on assignmentIds)
    let atRiskStudents: AtRiskStudentEntry[] = [];

    if (assignmentIds.length > 0) {
      const atRiskCheckpoints = await db
        .select({
          checkpointId: checkpoints.id,
          checkpointState: checkpoints.state,
          dueDate: checkpoints.dueDate,
          minConsultations: checkpoints.minConsultations,
          studentId: checkpoints.studentId,
          studentName: users.name,
          assignmentId: assignments.id,
          assignmentTitle: assignments.title,
        })
        .from(checkpoints)
        .innerJoin(assignments, eq(checkpoints.assignmentId, assignments.id))
        .innerJoin(users, eq(checkpoints.studentId, users.id))
        .where(
          and(
            inArray(checkpoints.assignmentId, assignmentIds),
            sql`${checkpoints.state} IN ('unlocked', 'revise', 'under_review', 'submitted')`,
          ),
        );

      if (atRiskCheckpoints.length > 0) {
        const checkpointIds = atRiskCheckpoints.map((c) => c.checkpointId);

        const [consultationCounts, submissionData, reviseCounts] = await Promise.all([
          db
            .select({
              checkpointId: consultations.checkpointId,
              count: sql<number>`count(*)::int`,
            })
            .from(consultations)
            .where(
              and(
                inArray(consultations.checkpointId, checkpointIds),
                eq(consultations.status, 'verified'),
              ),
            )
            .groupBy(consultations.checkpointId),
          db
            .select({
              checkpointId: submissions.checkpointId,
              count: sql<number>`count(*)::int`,
              latestDate: sql<Date>`max(${submissions.uploadedAt})`,
            })
            .from(submissions)
            .where(inArray(submissions.checkpointId, checkpointIds))
            .groupBy(submissions.checkpointId),
          db
            .select({
              checkpointId: submissions.checkpointId,
              count: sql<number>`count(*)::int`,
            })
            .from(reviews)
            .innerJoin(submissions, eq(reviews.submissionId, submissions.id))
            .where(
              and(inArray(submissions.checkpointId, checkpointIds), eq(reviews.decision, 'revise')),
            )
            .groupBy(submissions.checkpointId),
        ]);

        const consultationMap = new Map(consultationCounts.map((c) => [c.checkpointId, c.count]));
        const submissionMap = new Map(
          submissionData.map((s) => [s.checkpointId, { count: s.count, latestDate: s.latestDate }]),
        );
        const reviseMap = new Map(reviseCounts.map((r) => [r.checkpointId, r.count]));

        const studentAssignmentGroups = new Map<
          string,
          {
            studentId: string;
            studentName: string;
            assignmentId: number;
            assignmentTitle: string;
            checkpoints: CheckpointRiskData[];
          }
        >();

        for (const cp of atRiskCheckpoints) {
          const key = `${cp.studentId}:${cp.assignmentId}`;
          if (!studentAssignmentGroups.has(key)) {
            studentAssignmentGroups.set(key, {
              studentId: cp.studentId,
              studentName: cp.studentName,
              assignmentId: cp.assignmentId,
              assignmentTitle: cp.assignmentTitle,
              checkpoints: [],
            });
          }
          const subInfo = submissionMap.get(cp.checkpointId);
          const underReviewWaitDays =
            cp.checkpointState === 'under_review' && subInfo?.latestDate
              ? Math.floor((Date.now() - subInfo.latestDate.getTime()) / (1000 * 60 * 60 * 24))
              : null;

          studentAssignmentGroups.get(key)!.checkpoints.push({
            checkpointId: cp.checkpointId,
            state: cp.checkpointState,
            dueDate: cp.dueDate ?? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            minConsultations: cp.minConsultations ?? 0,
            verifiedConsultationCount: consultationMap.get(cp.checkpointId) ?? 0,
            submissionCount: subInfo?.count ?? 0,
            latestSubmissionDate: subInfo?.latestDate ?? null,
            reviseCount: reviseMap.get(cp.checkpointId) ?? 0,
            underReviewWaitDays,
          });
        }

        const now = new Date();
        const severityOrder: Record<RiskLevel, number> = { high: 0, medium: 1, low: 2 };
        atRiskStudents = Array.from(studentAssignmentGroups.values())
          .map((group) => {
            const assessment = computeStudentRisk({
              studentId: group.studentId,
              now,
              checkpoints: group.checkpoints,
            });
            return {
              studentName: group.studentName,
              studentId: group.studentId,
              assignmentTitle: group.assignmentTitle,
              assignmentId: group.assignmentId,
              riskLevel: assessment.level,
              factors: assessment.factors,
            };
          })
          .filter((entry) => entry.factors.length > 0)
          .sort((a, b) => severityOrder[a.riskLevel] - severityOrder[b.riskLevel]);
      }
    }

    const statusLabel = (state: string) =>
      state === 'submitted'
        ? 'Submitted'
        : state === 'under_review'
          ? 'Under Review'
          : state === 'passed'
            ? 'Pass'
            : 'Revise';

    return {
      pendingReviewCount,
      pendingReviewItems: pendingReviewItems.map((item) => ({
        submissionId: item.submissionId,
        checkpointName: item.checkpointName,
        assignmentTitle: item.assignmentTitle,
        studentName: item.studentName,
        submittedAt: item.submittedAt ? item.submittedAt.toISOString() : null,
        waitTimeDays: Math.floor(
          (Date.now() - (item.submittedAt?.getTime() ?? Date.now())) / (1000 * 60 * 60 * 24),
        ),
      })),
      recentSubmissions: recentSubmissions.map((rs) => ({
        submissionId: rs.submissionId,
        studentName: rs.studentName,
        assignmentTitle: rs.assignmentTitle,
        checkpointName: rs.checkpointName,
        submittedAt: rs.submittedAt ? rs.submittedAt.toISOString() : null,
        status: statusLabel(rs.checkpointState),
      })),
      assignments: assignmentsWithDetails,
      atRiskStudents,
    };
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'getInstructorDashboardDataHandler',
    });
  }
}
