// Server-only handler for instructor dashboard data
import { eq, and, desc, sql, inArray, isNull } from 'drizzle-orm';
import { getDb } from '../db/index';
import { assignments, assignmentStudents, checkpoints } from '../db/schema/assignments';
import { submissions } from '../db/schema/submissions';
import { users } from '../db/schema/users';
import { getSessionFromHeaders } from './auth';
import { serverError, ErrorCode } from '@/lib/errors';
import type { NonNullableSession } from '../lib/types';

function isInstructor(session: NonNullableSession | null): session is NonNullableSession {
  return !!session && session.user.role === 'instructor';
}

/**
 * Get all data for the instructor dashboard.
 */
export async function getInstructorDashboardDataHandler() {
  const session = await getSessionFromHeaders();
  if (!isInstructor(session)) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const db = getDb();
  const instructorId = session.user.id;

  try {
    // 1. Pending review queue — count + FIFO list
    const instructorAssignments = await db
      .select({ id: assignments.id })
      .from(assignments)
      .where(and(eq(assignments.instructorId, instructorId), isNull(assignments.deletedAt)));

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
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(checkpoints)
        .where(
          and(
            inArray(checkpoints.assignmentId, assignmentIds),
            sql`${checkpoints.state} IN ('submitted', 'under_review')`,
          ),
        );
      pendingReviewCount = Number(count);

      // List — oldest submissions first (FIFO)
      pendingReviewItems = await db
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
        .limit(50);

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

    // 2. Recent submissions (last 5)
    const recentSubmissions = await db
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
      .limit(5);

    // 3. Assignment overview — all active assignments with student count and progress
    const assignmentOverview = await db
      .select({
        id: assignments.id,
        title: assignments.title,
        finalDeadline: assignments.finalDeadline,
        createdAt: assignments.createdAt,
      })
      .from(assignments)
      .where(and(eq(assignments.instructorId, instructorId), isNull(assignments.deletedAt)))
      .orderBy(desc(assignments.createdAt));

    const overviewIds = assignmentOverview.map((a) => a.id);
    let studentCountMap = new Map<number, number>();
    let pendingReviewCountMap = new Map<number, number>();
    let progressMap = new Map<number, number>();

    if (overviewIds.length > 0) {
      const counts = await db
        .select({
          assignmentId: assignmentStudents.assignmentId,
          count: sql<number>`count(*)::int`,
        })
        .from(assignmentStudents)
        .where(inArray(assignmentStudents.assignmentId, overviewIds))
        .groupBy(assignmentStudents.assignmentId);
      studentCountMap = new Map(counts.map((c) => [c.assignmentId, c.count]));

      const pendingCounts = await db
        .select({ assignmentId: checkpoints.assignmentId, count: sql<number>`count(*)::int` })
        .from(checkpoints)
        .where(
          and(
            inArray(checkpoints.assignmentId, overviewIds),
            sql`${checkpoints.state} IN ('submitted', 'under_review')`,
          ),
        )
        .groupBy(checkpoints.assignmentId);
      pendingReviewCountMap = new Map(pendingCounts.map((c) => [c.assignmentId, c.count]));

      const progressData = await db
        .select({
          assignmentId: checkpoints.assignmentId,
          totalCount: sql<number>`count(*)::int`,
          passedCount: sql<number>`count(*) FILTER (WHERE ${checkpoints.state} = 'passed')::int`,
        })
        .from(checkpoints)
        .where(inArray(checkpoints.assignmentId, overviewIds))
        .groupBy(checkpoints.assignmentId);
      progressMap = new Map(
        progressData.map((p) => [
          p.assignmentId,
          p.totalCount > 0 ? Math.round((p.passedCount / p.totalCount) * 100) : 0,
        ]),
      );
    }

    const assignmentsWithDetails = assignmentOverview.map((a) => ({
      id: a.id,
      title: a.title,
      finalDeadline: a.finalDeadline,
      studentCount: studentCountMap.get(a.id) ?? 0,
      pendingReviewCount: pendingReviewCountMap.get(a.id) ?? 0,
      overallProgressPercent: progressMap.get(a.id) ?? 0,
    }));

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
        submittedAt: item.submittedAt,
        waitTimeDays: Math.floor(
          (Date.now() - (item.submittedAt?.getTime() ?? Date.now())) / (1000 * 60 * 60 * 24),
        ),
      })),
      recentSubmissions: recentSubmissions.map((rs) => ({
        submissionId: rs.submissionId,
        studentName: rs.studentName,
        assignmentTitle: rs.assignmentTitle,
        checkpointName: rs.checkpointName,
        submittedAt: rs.submittedAt,
        status: statusLabel(rs.checkpointState),
      })),
      assignments: assignmentsWithDetails,
    };
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'getInstructorDashboardDataHandler',
    });
  }
}
