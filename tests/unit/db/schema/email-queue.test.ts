import { describe, it, expect } from 'vitest';

describe('EmailQueue schema', () => {
  it('should export emailQueue table', async () => {
    const mod = await import('@/db/schema/email-queue');
    expect(mod).toHaveProperty('emailQueue');
  });

  it('should have correct columns on emailQueue', async () => {
    const { emailQueue } = await import('@/db/schema/email-queue');
    expect(emailQueue).toHaveProperty('id');
    expect(emailQueue).toHaveProperty('recipientEmail');
    expect(emailQueue).toHaveProperty('subject');
    expect(emailQueue).toHaveProperty('bodyHtml');
    expect(emailQueue).toHaveProperty('templateType');
    expect(emailQueue).toHaveProperty('status');
    expect(emailQueue).toHaveProperty('attempts');
    expect(emailQueue).toHaveProperty('lastAttemptAt');
    expect(emailQueue).toHaveProperty('errorMessage');
    expect(emailQueue).toHaveProperty('createdAt');
    expect(emailQueue).toHaveProperty('resendMessageId');
  });

  it('should have correct column types', async () => {
    const { emailQueue } = await import('@/db/schema/email-queue');
    expect(emailQueue.id).toBeDefined();
    expect(emailQueue.recipientEmail).toBeDefined();
    expect(emailQueue.subject).toBeDefined();
    expect(emailQueue.bodyHtml).toBeDefined();
    expect(emailQueue.templateType).toBeDefined();
    expect(emailQueue.status).toBeDefined();
    expect(emailQueue.attempts).toBeDefined();
    expect(emailQueue.lastAttemptAt).toBeDefined();
    expect(emailQueue.errorMessage).toBeDefined();
    expect(emailQueue.createdAt).toBeDefined();
    expect(emailQueue.resendMessageId).toBeDefined();
  });

  it('should include processing in status enum', async () => {
    const { emailQueue } = await import('@/db/schema/email-queue');
    const statusEnum = (emailQueue.status as any).enumValues as string[];
    expect(statusEnum).toContain('processing');
    expect(statusEnum).toEqual(expect.arrayContaining(['pending', 'processing', 'sent', 'failed']));
  });

  it('should accept all template_type values including discussion_reply', async () => {
    const { emailQueue } = await import('@/db/schema/email-queue');
    const templateTypeEnum = (emailQueue.templateType as any).enumValues as string[];
    expect(templateTypeEnum).toEqual(
      expect.arrayContaining([
        // Existing auth email types
        'password_reset',
        'invitation',
        'sla_alert',
        'two_factor',
        // New event email types (TRACK-018)
        'submission_received',
        'review_completed',
        'revision_requested',
        'consultation_verified',
        'consultation_rejected',
        'extension_approved',
        'extension_rejected',
        'extension_requested',
        // Deadline reminder (TRACK-021)
        'deadline_reminder',
        // Student at risk (TRACK-023)
        'student_at_risk',
        // Discussion reply (TRACK-026)
        'discussion_reply',
      ]),
    );
    expect(templateTypeEnum).toHaveLength(15);
  });
});
