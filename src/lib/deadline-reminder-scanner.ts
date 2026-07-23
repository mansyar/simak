/**
 * Proactive deadline reminder scanner.
 *
 * Once per hour, finds student checkpoints approaching their due date and
 * dispatches a tiered reminder (in-app notification + email) at 7-day,
 * 3-day, and 1-day lead times.
 *
 * Non-overlapping tier bands prevent simultaneous multi-tier firing:
 *   7d band: dueDate <= NOW()+7d AND dueDate > NOW()+3d
 *   3d band: dueDate <= NOW()+3d AND dueDate > NOW()+1d
 *   1d band: dueDate <= NOW()+1d AND dueDate > NOW()
 *
 * Multi-instance safe via ON CONFLICT (checkpointId, tier) DO NOTHING dedup.
 * Advisory only — failures are logged but do not propagate.
 */
import { and, eq, isNull, sql } from 'drizzle-orm';
import { getDb } from '@/db/index';
import { checkpoints, assignments } from '@/db/schema/assignments';
import { users } from '@/db/schema/users';
import { notifications } from '@/db/schema/notifications';
import { deadlineReminders } from '@/db/schema/deadline-reminders';
import { getNotificationKeys } from '@/lib/i18n-server';
import { sendDeadlineReminderEmail } from '@/lib/deadline-reminder-email';
import { shouldSendInAppNotification } from '@/lib/notification-prefs';

const REMINDER_TIERS = [
  { tier: '7d', leadDays: 7 },
  { tier: '3d', leadDays: 3 },
  { tier: '1d', leadDays: 1 },
] as const;

export async function processDeadlineReminders(): Promise<void> {
  const db = getDb();

  for (let i = 0; i < REMINDER_TIERS.length; i++) {
    const { tier, leadDays } = REMINDER_TIERS[i];
    // Lower bound is the next tier's leadDays (or 0 for the last tier)
    const lowerBoundDays = i + 1 < REMINDER_TIERS.length ? REMINDER_TIERS[i + 1].leadDays : 0;

    try {
      // Query checkpoints due in this tier's non-overlapping band
      const dueCheckpoints = await db
        .select({
          checkpointId: checkpoints.id,
          assignmentId: assignments.id,
          assignmentTitle: assignments.title,
          checkpointName: checkpoints.name,
          dueDate: checkpoints.dueDate,
          studentId: checkpoints.studentId,
          settings: users.settings,
        })
        .from(checkpoints)
        .innerJoin(assignments, eq(checkpoints.assignmentId, assignments.id))
        .innerJoin(users, eq(checkpoints.studentId, users.id))
        .where(
          and(
            sql`${checkpoints.state} IN ('unlocked', 'revise')`,
            sql`${checkpoints.dueDate} <= NOW() + INTERVAL '1 day' * ${leadDays}`,
            sql`${checkpoints.dueDate} > NOW() + INTERVAL '1 day' * ${lowerBoundDays}`,
            isNull(assignments.deletedAt),
            isNull(users.deletedAt),
          ),
        );

      if (dueCheckpoints.length === 0) continue;

      // Dedup + notification insert: atomic (SQL styleguide §6.1)
      // Email dispatch: post-commit advisory (SQL styleguide §6.4)
      const remindersToSend = await db.transaction(async (tx) => {
        // Dedup: INSERT INTO deadline_reminders ON CONFLICT DO NOTHING RETURNING *
        // Only rows where the insert succeeded (this instance won the race) are returned
        const winners = await tx
          .insert(deadlineReminders)
          .values(
            dueCheckpoints.map((c) => ({
              checkpointId: c.checkpointId,
              studentId: c.studentId,
              tier,
            })),
          )
          .onConflictDoNothing({
            target: [deadlineReminders.checkpointId, deadlineReminders.tier],
          })
          .returning();

        if (winners.length === 0) return [];

        // Match winners back to checkpoint data for notification/email content
        const winnerIds = new Set(winners.map((w) => w.checkpointId));
        const toSend = dueCheckpoints.filter((c) => winnerIds.has(c.checkpointId));

        // Batch insert in-app notifications (single INSERT)
        // Only for students who haven't disabled in-app notifications for deadline_reminder
        const notifiableCheckpoints = toSend.filter((c) =>
          shouldSendInAppNotification(c.settings, 'deadline_reminder'),
        );

        if (notifiableCheckpoints.length > 0) {
          const keys = getNotificationKeys('deadline_reminder');
          const notificationValues = notifiableCheckpoints.map((c) => ({
            userId: c.studentId,
            type: 'deadline_reminder',
            titleKey: keys.titleKey,
            messageKey: keys.messageKey,
            params: {
              assignmentTitle: c.assignmentTitle,
              checkpointName: c.checkpointName,
              dueDate: String(c.dueDate),
            },
            channel: 'in_app',
            metadata: {
              assignmentId: c.assignmentId,
              checkpointId: c.checkpointId,
            },
          }));

          await tx.insert(notifications).values(notificationValues);
        }
        return toSend;
      });

      if (remindersToSend.length === 0) continue;

      // Send emails concurrently — failures don't short-circuit (advisory, post-commit)
      await Promise.allSettled(
        remindersToSend.map((c) =>
          sendDeadlineReminderEmail({
            recipientId: c.studentId,
            assignmentId: c.assignmentId,
            assignmentTitle: c.assignmentTitle,
            checkpointName: c.checkpointName,
            checkpointId: c.checkpointId,
            dueDate: c.dueDate,
          }),
        ),
      );
    } catch (error) {
      console.error({
        event: 'deadline_reminder.scan_error',
        tier,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
