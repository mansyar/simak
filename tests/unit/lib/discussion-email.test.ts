/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/event-email', () => ({
  enqueueEventEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/email-templates', () => ({
  buildDiscussionReplyHtml: vi.fn().mockReturnValue('<html>mock</html>'),
}));

import { sendDiscussionReplyEmail } from '@/lib/discussion-email';
import { enqueueEventEmail } from '@/lib/event-email';

describe('sendDiscussionReplyEmail', () => {
  const opts = {
    recipientId: 'user-123',
    authorName: 'Alice Johnson',
    checkpointName: 'Draft Review',
    assignmentTitle: 'Thesis 2026',
    messagePreview: 'Can you clarify the requirements?',
    assignmentId: 5,
    checkpointId: 12,
    target: 'instructor' as const,
  };

  beforeEach(() => {
    vi.mocked(enqueueEventEmail).mockClear();
  });

  it('calls enqueueEventEmail with correct opts', async () => {
    await sendDiscussionReplyEmail(opts);

    expect(enqueueEventEmail).toHaveBeenCalledTimes(1);
    const call = vi.mocked(enqueueEventEmail).mock.calls[0][0];
    expect(call.recipientId).toBe('user-123');
    expect(call.subjectKey).toBe('emails.subjects.discussionReply');
    expect(call.templateType).toBe('discussion_reply');
  });

  it('passes a buildBody function that returns HTML', async () => {
    await sendDiscussionReplyEmail(opts);

    const call = vi.mocked(enqueueEventEmail).mock.calls[0][0];
    expect(typeof call.buildBody).toBe('function');
    const html = call.buildBody('en');
    expect(html).toBe('<html>mock</html>');
  });

  it('passes locale to buildBody', async () => {
    await sendDiscussionReplyEmail(opts);

    const call = vi.mocked(enqueueEventEmail).mock.calls[0][0];
    call.buildBody('id');
    const { buildDiscussionReplyHtml } = await import('@/lib/email-templates');
    expect(vi.mocked(buildDiscussionReplyHtml)).toHaveBeenCalledWith(
      expect.objectContaining({ locale: 'id' }),
    );
  });

  it('passes all params to buildDiscussionReplyHtml including target', async () => {
    await sendDiscussionReplyEmail(opts);

    const call = vi.mocked(enqueueEventEmail).mock.calls[0][0];
    call.buildBody('en');
    const { buildDiscussionReplyHtml } = await import('@/lib/email-templates');
    expect(vi.mocked(buildDiscussionReplyHtml)).toHaveBeenCalledWith(
      expect.objectContaining({
        authorName: 'Alice Johnson',
        checkpointName: 'Draft Review',
        assignmentTitle: 'Thesis 2026',
        messagePreview: 'Can you clarify the requirements?',
        assignmentId: 5,
        checkpointId: 12,
        target: 'instructor',
      }),
    );
  });
});
