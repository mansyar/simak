/**
 * Deadline reminder email helper.
 *
 * Stub — fully implemented in Phase 3 (Email Template, Helper & i18n).
 * The scanner imports this function and the test mocks it.
 */

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
 *
 * Phase 3 will implement this with `enqueueEventEmail` + `buildDeadlineReminderHtml`.
 */
export async function sendDeadlineReminderEmail(_opts: DeadlineReminderEmailOpts): Promise<void> {
  // TODO: Phase 3 — implement with enqueueEventEmail + buildDeadlineReminderHtml
}
