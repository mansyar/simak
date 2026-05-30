import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processEmailQueue } from '@/lib/email-queue-processor';
import { getDb } from '@/db/index';
import { getEnv } from '@/config/env';
import { emailQueue } from '@/db/schema/index';

// --- Module-level mocks ---

vi.mock('@/db/index', () => ({ getDb: vi.fn() }));
vi.mock('@/config/env', () => ({
  getEnv: vi.fn().mockReturnValue({ RESEND_API_KEY: 'test-key' }),
}));

const { mockResendSend, ResendMock } = vi.hoisted(() => {
  const send = vi.fn();
  const mock = vi.fn(function () {
    return { emails: { send } };
  });
  return { mockResendSend: send, ResendMock: mock };
});

vi.mock('resend', () => ({ Resend: ResendMock }));

// --- Mock DB with fluent query builder ---

interface MockDb {
  select: ReturnType<typeof vi.fn>;
  from: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  orderBy: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  then: ReturnType<typeof vi.fn>;
}

function createMockDb(): MockDb {
  return {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    then: vi.fn(),
  };
}

function makeEmail(
  overrides: Partial<{
    id: number;
    recipientEmail: string;
    subject: string;
    bodyHtml: string;
    templateType: string;
    status: string;
    attempts: number | null;
    lastAttemptAt: Date | null;
    errorMessage: string | null;
    createdAt: Date;
  }> = {},
) {
  return {
    id: 1,
    recipientEmail: 'user@test.com',
    subject: 'Test Email',
    bodyHtml: '<p>Hello</p>',
    templateType: 'invitation',
    status: 'pending',
    attempts: 0,
    lastAttemptAt: null,
    errorMessage: null,
    createdAt: new Date('2026-05-30T00:00:00Z'),
    ...overrides,
  };
}

describe('email-queue-processor', () => {
  let mockDb: MockDb;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    vi.mocked(getDb).mockReturnValue(mockDb as any);
    mockResendSend.mockReset();
  });

  describe('processEmailQueue', () => {
    it('processes pending emails in order', async () => {
      const emails = [
        makeEmail({ id: 1, recipientEmail: 'first@test.com' }),
        makeEmail({ id: 2, recipientEmail: 'second@test.com' }),
      ];
      mockDb.then.mockImplementation((onfulfilled: (v: any) => any) =>
        Promise.resolve(emails).then(onfulfilled),
      );
      mockResendSend.mockResolvedValue({ data: { id: 'sent-1' }, error: null });

      const result = await processEmailQueue();

      expect(result.processed).toBe(2);
      expect(result.sent).toBe(2);
      expect(result.failed).toBe(0);

      // Verify select chain was called with correct args
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.from).toHaveBeenCalledWith(emailQueue);
      expect(mockDb.orderBy).toHaveBeenCalledWith(emailQueue.createdAt);
      expect(mockDb.limit).toHaveBeenCalledWith(10);
    });

    it('updates status to sent on successful send', async () => {
      mockDb.then.mockImplementation((onfulfilled: (v: any) => any) =>
        Promise.resolve([makeEmail()]).then(onfulfilled),
      );
      mockResendSend.mockResolvedValue({ data: { id: 'sent-1' }, error: null });

      const result = await processEmailQueue();

      expect(result.sent).toBe(1);
      // verify update was called with status 'sent'
      const setCall = mockDb.set.mock.calls[0]?.[0];
      expect(setCall?.status).toBe('sent');
      expect(mockDb.update).toHaveBeenCalledWith(emailQueue);
    });

    it('increments attempts and stores error on send failure', async () => {
      mockDb.then.mockImplementation((onfulfilled: (v: any) => any) =>
        Promise.resolve([makeEmail()]).then(onfulfilled),
      );
      mockResendSend.mockRejectedValue(new Error('API error'));

      const result = await processEmailQueue();

      expect(result.failed).toBe(1);
      expect(result.sent).toBe(0);

      const setCall = mockDb.set.mock.calls[0]?.[0];
      expect(setCall?.attempts).toBe(1);
      expect(setCall?.errorMessage).toBe('API error');
      expect(setCall?.lastAttemptAt).toBeInstanceOf(Date);
    });

    it('returns error from Resend response error object', async () => {
      mockDb.then.mockImplementation((onfulfilled: (v: any) => any) =>
        Promise.resolve([makeEmail()]).then(onfulfilled),
      );
      mockResendSend.mockResolvedValue({ data: null, error: { message: 'Rate limited' } });

      const result = await processEmailQueue();

      expect(result.failed).toBe(1);
      const setCall = mockDb.set.mock.calls[0]?.[0];
      expect(setCall?.errorMessage).toBe('Rate limited');
    });

    it('respects backoff and skips emails not yet due for retry', async () => {
      const recentAttempt = new Date(Date.now() - 5_000); // 5 seconds ago
      const emails = [
        makeEmail({
          id: 1,
          attempts: 1,
          lastAttemptAt: recentAttempt, // needs 30s backoff
        }),
      ];
      mockDb.then.mockImplementation((onfulfilled: (v: any) => any) =>
        Promise.resolve(emails).then(onfulfilled),
      );

      const result = await processEmailQueue();

      expect(result.processed).toBe(0); // skipped due to backoff
      expect(mockResendSend).not.toHaveBeenCalled();
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('processes email when backoff interval has elapsed', async () => {
      const oldAttempt = new Date(Date.now() - 60_000); // 60 seconds ago (> 30s backoff)
      const emails = [
        makeEmail({
          id: 1,
          attempts: 1,
          lastAttemptAt: oldAttempt,
        }),
      ];
      mockDb.then.mockImplementation((onfulfilled: (v: any) => any) =>
        Promise.resolve(emails).then(onfulfilled),
      );
      mockResendSend.mockResolvedValue({ data: { id: 'sent-1' }, error: null });

      const result = await processEmailQueue();

      expect(result.processed).toBe(1);
      expect(result.sent).toBe(1);
      expect(mockResendSend).toHaveBeenCalled();
    });

    it('marks as failed after 3 failed attempts', async () => {
      const emails = [
        makeEmail({
          id: 1,
          attempts: 2, // already failed twice (needs 5min backoff)
          lastAttemptAt: new Date(Date.now() - 360_000), // 6 min ago > 5 min backoff
        }),
      ];
      mockDb.then.mockImplementation((onfulfilled: (v: any) => any) =>
        Promise.resolve(emails).then(onfulfilled),
      );
      mockResendSend.mockRejectedValue(new Error('Final error'));

      const result = await processEmailQueue();

      expect(result.failed).toBe(1);
      expect(result.sent).toBe(0);

      const setCall = mockDb.set.mock.calls[0]?.[0];
      expect(setCall?.attempts).toBe(3);
      expect(setCall?.status).toBe('failed');
      expect(setCall?.errorMessage).toBe('Final error');
    });

    it('processes emails with null attempts (default 0)', async () => {
      mockDb.then.mockImplementation((onfulfilled: (v: any) => any) =>
        Promise.resolve([makeEmail({ attempts: null })]).then(onfulfilled),
      );
      mockResendSend.mockRejectedValue(new Error('Fail'));

      const result = await processEmailQueue();

      expect(result.failed).toBe(1);
      const setCall = mockDb.set.mock.calls[0]?.[0];
      expect(setCall?.attempts).toBe(1); // null → 0 + 1
    });

    it('clamps backoff index for attempts >= 3 (30min interval)', async () => {
      // attempts=3 means backoff index is clamped to 3 → 30 min delay
      const oldEnough = new Date(Date.now() - 2_000_000); // 33 min ago > 30 min
      const emails = [
        makeEmail({
          id: 1,
          attempts: 3,
          lastAttemptAt: oldEnough,
        }),
      ];
      mockDb.then.mockImplementation((onfulfilled: (v: any) => any) =>
        Promise.resolve(emails).then(onfulfilled),
      );
      mockResendSend.mockResolvedValue({ data: { id: 'sent-1' }, error: null });

      const result = await processEmailQueue();

      expect(result.processed).toBe(1);
      expect(result.sent).toBe(1);
    });

    it('uses custom EMAIL_FROM env var when set', async () => {
      const origFrom = process.env.EMAIL_FROM;
      process.env.EMAIL_FROM = 'custom@simak.app';

      mockDb.then.mockImplementation((onfulfilled: (v: any) => any) =>
        Promise.resolve([makeEmail()]).then(onfulfilled),
      );
      mockResendSend.mockResolvedValue({ data: { id: 'sent-1' }, error: null });

      await processEmailQueue();

      expect(mockResendSend).toHaveBeenCalled();
      const sendArgs = mockResendSend.mock.calls[0]?.[0];
      expect(sendArgs?.from).toBe('custom@simak.app');

      process.env.EMAIL_FROM = origFrom;
    });

    it('returns counts when queue is empty', async () => {
      mockDb.then.mockImplementation((onfulfilled: (v: any) => any) =>
        Promise.resolve([]).then(onfulfilled),
      );

      const result = await processEmailQueue();

      expect(result.processed).toBe(0);
      expect(result.sent).toBe(0);
      expect(result.failed).toBe(0);
      expect(mockResendSend).not.toHaveBeenCalled();
    });
  });
});
