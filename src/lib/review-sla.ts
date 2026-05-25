/**
 * SLA breach deadline adjustment and notification dispatch.
 *
 * Extracted from reviews.server.ts to keep handlers under the 500-line modularity limit.
 * Both functions are called from submitReviewHandler.
 */
import { eq, and, gt, isNull, sql } from 'drizzle-orm';
import { checkpoints, assignments } from '../db/schema/assignments';
import { users } from '../db/schema/users';
import { notifications } from '../db/schema/notifications';
import { sendSLAAlertEmail } from './email';

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
 * Extends the affected checkpoint's dueDate, subsequent checkpoints' dueDates,
 * and the assignment's finalDeadline by the breach duration.
 *
 * Must be called inside the review transaction (tx).
 */
export async function adjustDeadlinesForBreach(
  tx: any,
  submission: SLASubmissionFields,
  breachDays: number,
): Promise<void> {
  // Extend affected checkpoint's dueDate (if it has one)
  if (submission.checkpointDueDate) {
    const extendedDueDate = new Date(
      submission.checkpointDueDate.getTime() + breachDays * 24 * 60 * 60 * 1000,
    );
    await tx
      .update(checkpoints)
      .set({ dueDate: extendedDueDate, updatedAt: new Date() })
      .where(eq(checkpoints.id, submission.checkpointId));
  }

  // Extend all subsequent checkpoints for this student in this assignment
  const subsequentCheckpoints = await tx
    .select({ id: checkpoints.id, dueDate: checkpoints.dueDate })
    .from(checkpoints)
    .where(
      and(
        eq(checkpoints.assignmentId, submission.assignmentId),
        eq(checkpoints.studentId, submission.studentId),
        gt(checkpoints.order, submission.checkpointOrder!),
      ),
    );

  for (const cp of subsequentCheckpoints) {
    if (cp.dueDate) {
      await tx
        .update(checkpoints)
        .set({
          dueDate: new Date(cp.dueDate.getTime() + breachDays * 24 * 60 * 60 * 1000),
          updatedAt: new Date(),
        })
        .where(eq(checkpoints.id, cp.id));
    }
  }

  // Extend assignment finalDeadline
  if (submission.finalDeadline) {
    await tx
      .update(assignments)
      .set({
        finalDeadline: new Date(
          submission.finalDeadline.getTime() + breachDays * 24 * 60 * 60 * 1000,
        ),
      })
      .where(eq(assignments.id, submission.assignmentId));
  }
}

/**
 * Dispatch SLA breach notifications to all admin/superadmin users.
 * Creates in-app and email notification records, and sends SLA alert emails.
 *
 * Advisory only — failures are logged but do not propagate the error.
 */
export async function dispatchSLABreachNotifications(
  db: any,
  submission: SLASubmissionFields,
  breachDays: number,
): Promise<void> {
  try {
    const adminUsers = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(and(sql`${users.role} IN ('superadmin', 'admin')`, isNull(users.deletedAt)));

    for (const admin of adminUsers) {
      // Create in-app notification
      await db.insert(notifications).values({
        userId: admin.id,
        type: 'sla_breach',
        title: 'SLA Breach',
        message: `Review for "${submission.checkpointName}" in "${submission.assignmentTitle}" by ${submission.studentName} was ${breachDays} day(s) overdue.`,
        channel: 'in_app',
        metadata: {
          assignmentId: submission.assignmentId,
          checkpointId: submission.checkpointId,
          breachDays,
          assignmentTitle: submission.assignmentTitle,
          studentName: submission.studentName,
          checkpointName: submission.checkpointName,
        },
      });

      // Create email notification record
      await db.insert(notifications).values({
        userId: admin.id,
        type: 'sla_breach',
        title: 'SLA Breach',
        message: `Review for "${submission.checkpointName}" in "${submission.assignmentTitle}" by ${submission.studentName} was ${breachDays} day(s) overdue.`,
        channel: 'email',
        metadata: {
          assignmentId: submission.assignmentId,
          checkpointId: submission.checkpointId,
          breachDays,
        },
      });

      // Send email
      await sendSLAAlertEmail({
        adminEmail: admin.email,
        adminName: admin.name,
        assignmentTitle: submission.assignmentTitle,
        studentName: submission.studentName,
        checkpointName: submission.checkpointName,
        breachDays,
      });
    }
  } catch (notifErr) {
    // Notifications are advisory — log but don't fail the review
    console.error('Failed to send SLA notifications:', notifErr);
  }
}
