/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { enqueueEventEmail } from '@/lib/event-email';
import { enqueueEmail, resolveEmailRecipient } from '@/lib/email';

vi.mock('@/db/index', () => ({ getDb: vi.fn() }));

vi.mock('@/config/env', () => ({
  getEnv: vi.fn().mockReturnValue({
    RESEND_API_KEY: 'test-key',
    BETTER_AUTH_URL: 'http://localhost:3000',
  }),
}));

vi.mock('@/lib/email', () => ({
  enqueueEmail: vi.fn().mockResolvedValue(undefined),
  resolveEmailRecipient: vi.fn().mockResolvedValue(null),
}));

describe('enqueueEventEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should enqueue email when recipient is valid', async () => {
    vi.mocked(resolveEmailRecipient).mockResolvedValue({
      email: 'user@test.com',
      locale: 'en',
    });
    vi.mocked(enqueueEmail).mockResolvedValue(undefined);

    await enqueueEventEmail({
      recipientId: 'user-1',
      subjectKey: 'emails.subjects.reviewCompleted',
      templateType: 'review_completed',
      buildBody: (locale) => `<html>body for ${locale}</html>`,
    });

    expect(resolveEmailRecipient).toHaveBeenCalledWith('user-1');
    expect(enqueueEmail).toHaveBeenCalledWith({
      recipientEmail: 'user@test.com',
      subject: '[SIMAK] Review Completed',
      bodyHtml: '<html>body for en</html>',
      templateType: 'review_completed',
    });
  });

  it('should localize subject for Indonesian recipient', async () => {
    vi.mocked(resolveEmailRecipient).mockResolvedValue({
      email: 'user@test.com',
      locale: 'id',
    });

    await enqueueEventEmail({
      recipientId: 'user-1',
      subjectKey: 'emails.subjects.reviewCompleted',
      templateType: 'review_completed',
      buildBody: () => '<html>body</html>',
    });

    expect(enqueueEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: '[SIMAK] Penilaian Selesai',
      }),
    );
  });

  it('should pass recipient locale to buildBody', async () => {
    vi.mocked(resolveEmailRecipient).mockResolvedValue({
      email: 'user@test.com',
      locale: 'id',
    });
    const buildBody = vi.fn().mockReturnValue('<html>id body</html>');

    await enqueueEventEmail({
      recipientId: 'user-1',
      subjectKey: 'emails.subjects.reviewCompleted',
      templateType: 'review_completed',
      buildBody,
    });

    expect(buildBody).toHaveBeenCalledWith('id');
  });

  it('should skip when recipient is null (soft-deleted or unverified)', async () => {
    vi.mocked(resolveEmailRecipient).mockResolvedValue(null);

    await enqueueEventEmail({
      recipientId: 'user-1',
      subjectKey: 'emails.subjects.reviewCompleted',
      templateType: 'review_completed',
      buildBody: () => '<html>body</html>',
    });

    expect(enqueueEmail).not.toHaveBeenCalled();
  });

  it('should not throw when enqueueEmail fails (advisory-only)', async () => {
    vi.mocked(resolveEmailRecipient).mockResolvedValue({
      email: 'user@test.com',
      locale: 'en',
    });
    vi.mocked(enqueueEmail).mockRejectedValue(new Error('service down'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      enqueueEventEmail({
        recipientId: 'user-1',
        subjectKey: 'emails.subjects.reviewCompleted',
        templateType: 'review_completed',
        buildBody: () => '<html>body</html>',
      }),
    ).resolves.toBeUndefined();

    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to enqueue review_completed email:',
      expect.any(Error),
    );
    consoleSpy.mockRestore();
  });

  it('should not throw when resolveEmailRecipient throws', async () => {
    vi.mocked(resolveEmailRecipient).mockRejectedValue(new Error('DB error'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      enqueueEventEmail({
        recipientId: 'user-1',
        subjectKey: 'emails.subjects.reviewCompleted',
        templateType: 'review_completed',
        buildBody: () => '<html>body</html>',
      }),
    ).resolves.toBeUndefined();

    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to enqueue review_completed email:',
      expect.any(Error),
    );
    consoleSpy.mockRestore();
  });
});

describe('enqueueEventEmail — email preference gate (TRACK-022)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(enqueueEmail).mockResolvedValue(undefined);
  });

  it('should skip enqueue when email is disabled for the notification type', async () => {
    vi.mocked(resolveEmailRecipient).mockResolvedValue({
      email: 'user@test.com',
      locale: 'en',
      settings: {
        reducedMotion: false,
        notificationPrefs: { review_completed: { email: false } },
      },
    });

    await enqueueEventEmail({
      recipientId: 'user-1',
      subjectKey: 'emails.subjects.reviewCompleted',
      templateType: 'review_completed',
      buildBody: () => '<html>body</html>',
    });

    expect(enqueueEmail).not.toHaveBeenCalled();
  });

  it('should send email when email pref is enabled for the type', async () => {
    vi.mocked(resolveEmailRecipient).mockResolvedValue({
      email: 'user@test.com',
      locale: 'en',
      settings: {
        reducedMotion: false,
        notificationPrefs: { review_completed: { email: true } },
      },
    });

    await enqueueEventEmail({
      recipientId: 'user-1',
      subjectKey: 'emails.subjects.reviewCompleted',
      templateType: 'review_completed',
      buildBody: () => '<html>body</html>',
    });

    expect(enqueueEmail).toHaveBeenCalledTimes(1);
  });

  it('should send email when no pref is set for the type (default true)', async () => {
    vi.mocked(resolveEmailRecipient).mockResolvedValue({
      email: 'user@test.com',
      locale: 'en',
      settings: { reducedMotion: false },
    });

    await enqueueEventEmail({
      recipientId: 'user-1',
      subjectKey: 'emails.subjects.reviewCompleted',
      templateType: 'review_completed',
      buildBody: () => '<html>body</html>',
    });

    expect(enqueueEmail).toHaveBeenCalledTimes(1);
  });

  it('should send email when settings is null (default true)', async () => {
    vi.mocked(resolveEmailRecipient).mockResolvedValue({
      email: 'user@test.com',
      locale: 'en',
      settings: null,
    });

    await enqueueEventEmail({
      recipientId: 'user-1',
      subjectKey: 'emails.subjects.reviewCompleted',
      templateType: 'review_completed',
      buildBody: () => '<html>body</html>',
    });

    expect(enqueueEmail).toHaveBeenCalledTimes(1);
  });

  it('should use notificationType override for preference lookup', async () => {
    vi.mocked(resolveEmailRecipient).mockResolvedValue({
      email: 'user@test.com',
      locale: 'en',
      settings: {
        reducedMotion: false,
        notificationPrefs: { deadline_extended: { email: false } },
      },
    });

    await enqueueEventEmail({
      recipientId: 'user-1',
      subjectKey: 'emails.subjects.extensionApproved',
      templateType: 'extension_approved',
      notificationType: 'deadline_extended',
      buildBody: () => '<html>body</html>',
    });

    expect(enqueueEmail).not.toHaveBeenCalled();
  });

  it('should not gate security-type emails (sla_alert exempt)', async () => {
    vi.mocked(resolveEmailRecipient).mockResolvedValue({
      email: 'admin@test.com',
      locale: 'en',
      settings: {
        reducedMotion: false,
        notificationPrefs: { sla_breach: { email: false } },
      },
    });

    await enqueueEventEmail({
      recipientId: 'admin-1',
      subjectKey: 'emails.subjects.sla_alert',
      templateType: 'sla_alert',
      buildBody: () => '<html>body</html>',
    });

    expect(enqueueEmail).toHaveBeenCalledTimes(1);
  });
});
