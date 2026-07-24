/**
 * SLA breach deadline adjustment and notification dispatch.
 *
 * Extracted from reviews.server.ts to keep handlers under the 500-line modularity limit.
 * Both functions are called from submitReviewHandler.
 */
import { eq, and, gt, isNull, sql } from 'drizzle-orm';
import { checkpoints } from '../db/schema/assignments';
import { users } from '../db/schema/users';
import { notifications } from '../db/schema/notifications';
import { sendSLAAlertEmail } from './email';
import { getNotificationKeys } from './i18n-server';
import { shouldSendInAppNotification } from './notification-prefs';
import type { Db } from '../db/index';

export interface SLASubmissionFields {
  checkpointId: number;
  checkpointDueDate: Date | null;
  checkpointName: string;
  checkpointOrder: number | null;
  assignmentId: number;
  assignmentTitle: string;
  studentId: string;
  studentName: string;
  finalDeadline: Date | null;
}

/**
 * Adjust deadlines when an SLA breach occurs.
 * Extends the affected checkpoint's dueDate and subsequent checkpoints'
 * dueDates by the breach duration. Per-student only — does NOT modify the
 * course-wide assignment finalDeadline (immutable per Track 10).
 *
 * Must be called inside the review transaction (tx).
 */
export async function adjustDeadlinesForBreach(
  tx: Db,
  submission: SLASubmissionFields,
  breachDays: number,
): Promise<void> {
  // Extend affected checkpoint's dueDate
  // After Phase 1 backfill, checkpoint dueDates are always populated
  const extendedDueDate = new Date(
    (submission.checkpointDueDate ?? new Date()).getTime() + breachDays * 24 * 60 * 60 * 1000,
  );
  await tx
    .update(checkpoints)
    .set({ dueDate: extendedDueDate, updatedAt: new Date() })
    .where(eq(checkpoints.id, submission.checkpointId));

  // Extend all subsequent checkpoints for this student in this assignment (bulk UPDATE)
  await tx
    .update(checkpoints)
    .set({
      dueDate: sql`COALESCE(${checkpoints.dueDate}, NOW()) + INTERVAL '1 day' * ${breachDays}`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(checkpoints.assignmentId, submission.assignmentId),
        eq(checkpoints.studentId, submission.studentId),
        gt(checkpoints.order, submission.checkpointOrder ?? 0),
      ),
    );
}

/**
 * Dispatch SLA breach notifications to all admin/superadmin users.
 * Creates in-app and email notification records, and sends SLA alert emails.
 *
 * Advisory only — failures are logged but do not propagate the error.
 */
export async function dispatchSLABreachNotifications(
  db: Db,
  submission: SLASubmissionFields,
  breachDays: number,
): Promise<void> {
  try {
    const adminUsers = await db
      .select({ id: users.id, name: users.name, email: users.email, settings: users.settings })
      .from(users)
      .where(and(sql`${users.role} IN ('superadmin', 'admin')`, isNull(users.deletedAt)));

    if (adminUsers.length === 0) return;

    const slaParams = {
      checkpointName: submission.checkpointName,
      assignmentTitle: submission.assignmentTitle,
      studentName: submission.studentName,
      breachDays: String(breachDays),
    };
    const slaKeys = getNotificationKeys('sla_breach');

    // Batch in-app notifications into a single INSERT (PERF-5)
    // Only insert for admins who haven't disabled in-app notifications for sla_breach
    const notifiableAdmins = adminUsers.filter((admin) =>
      shouldSendInAppNotification(admin.settings, 'sla_breach'),
    );

    if (notifiableAdmins.length > 0) {
      const notificationValues = notifiableAdmins.map((admin) => ({
        userId: admin.id,
        type: 'sla_breach',
        titleKey: slaKeys.titleKey,
        messageKey: slaKeys.messageKey,
        params: slaParams,
        channel: 'in_app',
        metadata: {
          assignmentId: submission.assignmentId,
          checkpointId: submission.checkpointId,
          breachDays,
          assignmentTitle: submission.assignmentTitle,
          studentName: submission.studentName,
          checkpointName: submission.checkpointName,
        },
      }));

      await db.insert(notifications).values(notificationValues);
    }

    // Send emails concurrently — failures don't short-circuit (PERF-5)
    await Promise.allSettled(
      adminUsers.map((admin) =>
        sendSLAAlertEmail({
          adminEmail: admin.email,
          adminName: admin.name,
          assignmentTitle: submission.assignmentTitle,
          studentName: submission.studentName,
          checkpointName: submission.checkpointName,
          breachDays,
        }),
      ),
    );
  } catch (notifErr) {
    // Notifications are advisory — log but don't fail the review
    console.error('Failed to send SLA notifications:', notifErr);
  }
}
