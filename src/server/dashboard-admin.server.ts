// Server-only handler for admin dashboard data
import { eq, and, desc, sql, isNull, lte, gte } from 'drizzle-orm';
import { getDb } from '../db/index';
import { assignments, checkpoints } from '../db/schema/assignments';
import { submissions } from '../db/schema/submissions';
import { consultations } from '../db/schema/consultations';
import { notifications } from '../db/schema/notifications';
import { users } from '../db/schema/users';
import { getSessionFromHeaders } from './auth';

function isAdmin(session: any): session is { user: { id: string; role: string }; session: any } {
  return !!session && (session.user.role === 'superadmin' || session.user.role === 'admin');
}

/**
 * Get all data for the admin dashboard.
 */
export async function getAdminDashboardDataHandler() {
  const session = await getSessionFromHeaders();
  if (!isAdmin(session)) {
    return { error: 'Unauthorized' };
  }

  const db = getDb();

  try {
    // 1. System metrics
    const [userCounts] = await db
      .select({
        total: sql<number>`count(*)::int`,
        instructors: sql<number>`count(*) FILTER (WHERE ${users.role} = 'instructor')::int`,
        students: sql<number>`count(*) FILTER (WHERE ${users.role} = 'student')::int`,
      })
      .from(users)
      .where(isNull(users.deletedAt));

    const [{ activeAssignmentCount }] = await db
      .select({ activeAssignmentCount: sql<number>`count(*)::int` })
      .from(assignments)
      .where(isNull(assignments.deletedAt));

    const [{ pendingReviewCount }] = await db
      .select({ pendingReviewCount: sql<number>`count(*)::int` })
      .from(checkpoints)
      .where(sql`${checkpoints.state} IN ('submitted', 'under_review')`);

    const [{ activeConsultationCount }] = await db
      .select({ activeConsultationCount: sql<number>`count(*)::int` })
      .from(consultations)
      .where(eq(consultations.status, 'pending'));

    const metrics = {
      totalUsers: Number(userCounts.total),
      instructors: Number(userCounts.instructors),
      students: Number(userCounts.students),
      activeAssignments: Number(activeAssignmentCount),
      pendingReviews: Number(pendingReviewCount),
      activeConsultations: Number(activeConsultationCount),
    };

    // 2. Recent activity feed (last 10 events from last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentActivity = await db
      .select({
        id: notifications.id,
        type: notifications.type,
        title: notifications.title,
        message: notifications.message,
        createdAt: notifications.createdAt,
      })
      .from(notifications)
      .where(gte(notifications.createdAt, sevenDaysAgo))
      .orderBy(desc(notifications.createdAt))
      .limit(10);

    // 3. Deadline escalation alerts — active SLA breaches (submissions older than 3 days)
    const slaThreshold = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const escalationAlerts = await db
      .select({
        submissionId: submissions.id,
        instructorName: users.name,
        assignmentTitle: assignments.title,
        checkpointName: checkpoints.name,
        studentName: sql<string>`${users.name}`.as('student_name'),
        daysOverdue: sql<number>`extract(day from now() - ${submissions.uploadedAt})::int`,
      })
      .from(submissions)
      .innerJoin(checkpoints, eq(submissions.checkpointId, checkpoints.id))
      .innerJoin(assignments, eq(checkpoints.assignmentId, assignments.id))
      .innerJoin(users, eq(checkpoints.studentId, users.id))
      .where(
        and(
          sql`${checkpoints.state} = 'submitted'`,
          lte(submissions.uploadedAt, slaThreshold),
          isNull(assignments.deletedAt),
        ),
      )
      .orderBy(desc(sql`extract(day from now() - ${submissions.uploadedAt})`));

    return {
      metrics,
      recentActivity: recentActivity.map((ra) => ({
        id: ra.id,
        type: ra.type,
        title: ra.title,
        message: ra.message,
        createdAt: ra.createdAt,
      })),
      escalationAlerts: escalationAlerts.map((ea) => ({
        submissionId: ea.submissionId,
        instructorName: ea.instructorName,
        assignmentTitle: ea.assignmentTitle,
        checkpointName: ea.checkpointName,
        studentName: ea.studentName,
        daysOverdue: Number(ea.daysOverdue),
      })),
    };
  } catch (err) {
    console.error('Failed to get admin dashboard data:', err);
    return { error: 'Internal Server Error' };
  }
}
