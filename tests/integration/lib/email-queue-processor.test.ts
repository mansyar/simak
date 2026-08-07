/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getDb } from '@/db/index';
import { emailQueue } from '@/db/schema/index';
import { processEmailQueue } from '@/lib/email-queue-processor';
import { eq, like } from 'drizzle-orm';

vi.mock('@/config/env', () => ({
  getEnv: vi.fn().mockReturnValue({
    DATABASE_URL:
      process.env.MIGRATE_DATABASE_URL ??
      process.env.DATABASE_URL ??
      'postgresql://simak:simak_password@localhost:5433/simak_test',
    DB_POOL_MAX: 5,
    DB_PREPARED_STATEMENTS_DISABLED: false,
    RESEND_API_KEY: 'test-key',
    LOG_LEVEL: 'info',
  }),
}));

const sentToEmails: string[] = [];

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(function () {
    return {
      emails: {
        send: vi.fn().mockImplementation(async ({ to }: { to: string }) => {
          sentToEmails.push(to);
          return { data: { id: 'sent-mock' }, error: null };
        }),
      },
    };
  }),
}));

describe('Email Queue Processor Integration', () => {
  const db = getDb();
  const testPrefix = 'multiworker-test-';

  beforeEach(async () => {
    sentToEmails.length = 0;
    await db.delete(emailQueue).where(like(emailQueue.recipientEmail, `${testPrefix}%`));
  });

  afterEach(async () => {
    await db.delete(emailQueue).where(like(emailQueue.recipientEmail, `${testPrefix}%`));
  });

  it('prevents duplicate delivery when two workers run concurrently', async () => {
    const emails = Array.from({ length: 10 }, (_, i) => ({
      recipientEmail: `${testPrefix}${i}@example.com`,
      subject: `Test subject ${i}`,
      bodyHtml: `<p>Body ${i}</p>`,
      templateType: 'invitation' as const,
      status: 'pending' as const,
      attempts: 0,
      lastAttemptAt: null,
      errorMessage: null,
    }));

    await db.insert(emailQueue).values(emails);

    const [resultA, resultB] = await Promise.all([processEmailQueue(), processEmailQueue()]);

    const totalSent = resultA.sent + resultB.sent;
    expect(totalSent).toBe(emails.length);
    expect(sentToEmails).toHaveLength(emails.length);

    const uniqueSent = new Set(sentToEmails);
    expect(uniqueSent.size).toBe(emails.length);

    const pendingRows = await db
      .select({ recipientEmail: emailQueue.recipientEmail, status: emailQueue.status })
      .from(emailQueue)
      .where(like(emailQueue.recipientEmail, `${testPrefix}%`));

    expect(pendingRows).toHaveLength(emails.length);
    expect(pendingRows.every((r) => r.status === 'sent')).toBe(true);
  });
});
