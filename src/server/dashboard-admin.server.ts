// Server-only handler for admin dashboard data
import { eq, and, desc, sql, isNull, lte, gte, aliasedTable } from 'drizzle-orm';
import { getDb } from '../db/index';
import { assignments, checkpoints } from '../db/schema/assignments';
import { submissions } from '../db/schema/submissions';
import { consultations } from '../db/schema/consultations';
import { notifications } from '../db/schema/notifications';
import { users } from '../db/schema/users';
import { emailQueue } from '../db/schema/email-queue';
import { getSessionFromHeaders } from './auth';
import { serverError, ErrorCode } from '@/lib/errors';
import { resolveNotificationContent } from '../lib/i18n-server';
import { isAdmin } from '@/lib/session-guards';

const instructorUsers = aliasedTable(users, 'instructor');

/**
 * Get all data for the admin dashboard.
 */
export async function getAdminDashboardDataHandler() {
  const session = await getSessionFromHeaders();
  if (!isAdmin(session)) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const db = getDb();

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const slaThreshold = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    // Run all 7 independent dashboard queries concurrently
    const [
      [userCounts],
      [{ activeAssignmentCount }],
      [{ pendingReviewCount }],
      [{ activeConsultationCount }],
      recentActivity,
      [emailCounts],
      escalationAlerts,
    ] = await Promise.all([
      db
        .select({
          total: sql<number>`count(*)::int`,
          instructors: sql<number>`count(*) FILTER (WHERE ${users.role} = 'instructor')::int`,
          students: sql<number>`count(*) FILTER (WHERE ${users.role} = 'student')::int`,
        })
        .from(users)
        .where(isNull(users.deletedAt)),
      db
        .select({ activeAssignmentCount: sql<number>`count(*)::int` })
        .from(assignments)
        .where(isNull(assignments.deletedAt)),
      db
        .select({ pendingReviewCount: sql<number>`count(*)::int` })
        .from(checkpoints)
        .where(sql`${checkpoints.state} IN ('submitted', 'under_review')`),
      db
        .select({ activeConsultationCount: sql<number>`count(*)::int` })
        .from(consultations)
        .where(eq(consultations.status, 'pending')),
      db
        .select({
          id: notifications.id,
          type: notifications.type,
          titleKey: notifications.titleKey,
          messageKey: notifications.messageKey,
          params: notifications.params,
          createdAt: notifications.createdAt,
        })
        .from(notifications)
        .where(gte(notifications.createdAt, sevenDaysAgo))
        .orderBy(desc(notifications.createdAt))
        .limit(10),
      db
        .select({
          pending: sql<number>`count(*) FILTER (WHERE ${emailQueue.status} = 'pending')::int`,
          sent: sql<number>`count(*) FILTER (WHERE ${emailQueue.status} = 'sent')::int`,
          failed: sql<number>`count(*) FILTER (WHERE ${emailQueue.status} = 'failed')::int`,
        })
        .from(emailQueue),
      db
        .select({
          submissionId: submissions.id,
          instructorName: instructorUsers.name,
          assignmentTitle: assignments.title,
          checkpointName: checkpoints.name,
          studentName: users.name,
          daysOverdue: sql<number>`(EXTRACT(EPOCH FROM now() - ${submissions.uploadedAt}) / 86400)::int`,
        })
        .from(submissions)
        .innerJoin(checkpoints, eq(submissions.checkpointId, checkpoints.id))
        .innerJoin(assignments, eq(checkpoints.assignmentId, assignments.id))
        .innerJoin(users, eq(checkpoints.studentId, users.id))
        .innerJoin(instructorUsers, eq(assignments.instructorId, instructorUsers.id))
        .where(
          and(
            sql`${checkpoints.state} = 'submitted'`,
            lte(submissions.uploadedAt, slaThreshold),
            isNull(assignments.deletedAt),
          ),
        )
        .orderBy(desc(sql`EXTRACT(EPOCH FROM now() - ${submissions.uploadedAt}) / 86400`)),
    ]);

    const metrics = {
      totalUsers: Number(userCounts.total),
      instructors: Number(userCounts.instructors),
      students: Number(userCounts.students),
      activeAssignments: Number(activeAssignmentCount),
      pendingReviews: Number(pendingReviewCount),
      activeConsultations: Number(activeConsultationCount),
    };

    return {
      metrics,
      emailQueueCounts: {
        pending: Number(emailCounts.pending),
        sent: Number(emailCounts.sent),
        failed: Number(emailCounts.failed),
      },
      recentActivity: recentActivity.map((ra) => {
        const content = resolveNotificationContent(ra.titleKey, ra.messageKey, ra.params, 'en');
        return {
          id: ra.id,
          type: ra.type,
          title: content.title,
          message: content.message,
          createdAt: ra.createdAt,
        };
      }),
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
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'getAdminDashboardDataHandler',
    });
  }
}
