/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/event-email', () => ({
  enqueueEventEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/email-templates', () => ({
  buildDeadlineReminderHtml: vi.fn().mockReturnValue('<html>mock</html>'),
}));

import { sendDeadlineReminderEmail } from '@/lib/deadline-reminder-email';
import { enqueueEventEmail } from '@/lib/event-email';

describe('sendDeadlineReminderEmail', () => {
  const opts = {
    recipientId: 'user-123',
    assignmentId: 5,
    assignmentTitle: 'Final Project',
    checkpointName: 'Draft Review',
    checkpointId: 12,
    dueDate: new Date('2026-07-30T23:59:59Z'),
  };

  beforeEach(() => {
    vi.mocked(enqueueEventEmail).mockClear();
  });

  it('calls enqueueEventEmail with correct opts', async () => {
    await sendDeadlineReminderEmail(opts);

    expect(enqueueEventEmail).toHaveBeenCalledTimes(1);
    const call = vi.mocked(enqueueEventEmail).mock.calls[0][0];
    expect(call.recipientId).toBe('user-123');
    expect(call.subjectKey).toBe('emails.subjects.deadlineReminder');
    expect(call.templateType).toBe('deadline_reminder');
  });

  it('passes assignmentTitle as subjectParams for interpolation', async () => {
    await sendDeadlineReminderEmail(opts);

    const call = vi.mocked(enqueueEventEmail).mock.calls[0][0];
    expect(call.subjectParams).toEqual({ assignmentTitle: 'Final Project' });
  });

  it('passes a buildBody function that returns HTML', async () => {
    await sendDeadlineReminderEmail(opts);

    const call = vi.mocked(enqueueEventEmail).mock.calls[0][0];
    expect(typeof call.buildBody).toBe('function');
    const html = call.buildBody('en');
    expect(html).toBe('<html>mock</html>');
  });

  it('passes locale to buildBody', async () => {
    await sendDeadlineReminderEmail(opts);

    const call = vi.mocked(enqueueEventEmail).mock.calls[0][0];
    call.buildBody('id');
    // buildDeadlineReminderHtml is mocked — just verify it was called with locale
    const { buildDeadlineReminderHtml } = await import('@/lib/email-templates');
    expect(vi.mocked(buildDeadlineReminderHtml)).toHaveBeenCalledWith(
      expect.objectContaining({ locale: 'id' }),
    );
  });
});
