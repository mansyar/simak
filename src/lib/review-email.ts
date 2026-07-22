import type { Locales } from '../i18n/types';
import { enqueueEventEmail } from './event-email';
import { buildReviewCompletedHtml, buildRevisionRequestedHtml } from './email-templates';

/**
 * Sends a review outcome email to the student (review_completed or revision_requested).
 * Post-commit advisory — never throws.
 */
export async function sendReviewEmail(opts: {
  studentId: string;
  decision: string;
  reviewerName: string | undefined;
  assignmentTitle: string | null;
  checkpointName: string | null;
  assignmentId: number;
  revisionDeadline: string | undefined;
}): Promise<void> {
  const isPass = opts.decision === 'pass';
  await enqueueEventEmail({
    recipientId: opts.studentId,
    subjectKey: isPass ? 'emails.subjects.reviewCompleted' : 'emails.subjects.revisionRequested',
    templateType: isPass ? 'review_completed' : 'revision_requested',
    buildBody: (locale: Locales) => {
      const base = {
        reviewerName: opts.reviewerName || 'An instructor',
        assignmentName: opts.assignmentTitle ?? '',
        checkpointName: opts.checkpointName ?? '',
        assignmentId: opts.assignmentId,
        locale,
      };
      return isPass
        ? buildReviewCompletedHtml(base)
        : buildRevisionRequestedHtml({ ...base, revisionDeadline: opts.revisionDeadline ?? '' });
    },
  });
}
