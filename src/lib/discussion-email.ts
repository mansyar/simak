import type { Locales } from '../i18n/types';
import { enqueueEventEmail } from './event-email';
import { buildDiscussionReplyHtml } from './email-templates';

export interface DiscussionReplyEmailOpts {
  recipientId: string;
  authorName: string;
  checkpointName: string;
  assignmentTitle: string;
  messagePreview: string;
  assignmentId: number;
  checkpointId: number;
  target: 'student' | 'instructor';
}

/**
 * Enqueue a discussion-reply email to the other party.
 * Advisory — never throws.
 */
export async function sendDiscussionReplyEmail(opts: DiscussionReplyEmailOpts): Promise<void> {
  await enqueueEventEmail({
    recipientId: opts.recipientId,
    subjectKey: 'emails.subjects.discussionReply',
    templateType: 'discussion_reply',
    buildBody: (locale: Locales) =>
      buildDiscussionReplyHtml({
        authorName: opts.authorName,
        checkpointName: opts.checkpointName,
        assignmentTitle: opts.assignmentTitle,
        messagePreview: opts.messagePreview,
        assignmentId: opts.assignmentId,
        checkpointId: opts.checkpointId,
        target: opts.target,
        locale,
      }),
  });
}
