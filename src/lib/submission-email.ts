import { enqueueEventEmail } from './event-email';
import { buildSubmissionReceivedHtml } from './email-templates';

/**
 * Sends a submission_received email to the instructor.
 * Post-commit advisory — never throws.
 */
export async function sendSubmissionReceivedEmail(opts: {
  instructorId: string;
  studentName: string;
  assignmentName: string;
  checkpointName: string;
  submissionId: number;
}): Promise<void> {
  await enqueueEventEmail({
    recipientId: opts.instructorId,
    subjectKey: 'emails.subjects.submissionReceived',
    templateType: 'submission_received',
    buildBody: (locale) =>
      buildSubmissionReceivedHtml({
        studentName: opts.studentName,
        assignmentName: opts.assignmentName,
        checkpointName: opts.checkpointName,
        submissionId: opts.submissionId,
        locale,
      }),
  });
}
