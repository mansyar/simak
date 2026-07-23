import type { Locales } from '../i18n/types';
import { enqueueEventEmail } from './event-email';
import { buildDeadlineReminderHtml } from './email-templates';

export interface DeadlineReminderEmailOpts {
  recipientId: string;
  assignmentId: number;
  assignmentTitle: string;
  checkpointName: string;
  checkpointId: number;
  dueDate: Date | null;
}

/**
 * Enqueue a deadline-reminder email for a student.
 * Advisory — never throws.
 */
export async function sendDeadlineReminderEmail(opts: DeadlineReminderEmailOpts): Promise<void> {
  await enqueueEventEmail({
    recipientId: opts.recipientId,
    subjectKey: 'emails.subjects.deadlineReminder',
    templateType: 'deadline_reminder',
    subjectParams: { assignmentTitle: opts.assignmentTitle },
    buildBody: (locale: Locales) =>
      buildDeadlineReminderHtml({
        assignmentTitle: opts.assignmentTitle,
        checkpointName: opts.checkpointName,
        assignmentId: opts.assignmentId,
        checkpointId: opts.checkpointId,
        dueDate: String(opts.dueDate),
        locale,
      }),
  });
}
