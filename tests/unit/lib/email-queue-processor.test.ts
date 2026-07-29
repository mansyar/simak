import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { processEmailQueue } from '@/lib/email-queue-processor';
import { getDb } from '@/db/index';
import { getEnv } from '@/config/env';
import { emailQueue } from '@/db/schema/index';
import { createMockDb, makeEmail, type MockDb, type FakeRow } from './helpers/email-queue-mock';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// --- Module-level mocks ---
vi.mock('@/db/index', () => ({ getDb: vi.fn() }));
vi.mock('@/config/env', () => ({
  getEnv: vi.fn().mockReturnValue({
    RESEND_API_KEY: 'test-key',
    EMAIL_FROM: 'SIMAK <noreply@simak.app>',
  }),
}));

const { mockChildLogger, mockResendSend, ResendMock } = vi.hoisted(() => {
  const childLogger = { error: vi.fn(), info: vi.fn(), warn: vi.fn() };
  const send = vi.fn();
  const mock = vi.fn(function () {
    return { emails: { send } };
  });
  return { mockChildLogger: childLogger, mockResendSend: send, ResendMock: mock };
});
vi.mock('@/lib/logger', () => ({
  logger: { child: vi.fn().mockReturnValue(mockChildLogger) },
}));

vi.mock('resend', () => ({ Resend: ResendMock }));

describe('email-queue-processor', () => {
  let mockDb: MockDb;

  function setupDb(rows: FakeRow[], resendResult?: { data: any; error: any } | Error): void {
    mockDb = createMockDb(rows);
    vi.mocked(getDb).mockReturnValue(mockDb as any);
    if (resendResult instanceof Error) {
      mockResendSend.mockRejectedValue(resendResult);
    } else if (resendResult) {
      mockResendSend.mockResolvedValue(resendResult);
    }
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockResendSend.mockReset();
  });

  describe('processEmailQueue', () => {
    it('processes pending emails in order', async () => {
      setupDb(
        [
          makeEmail({ id: 1, recipientEmail: 'first@test.com' }),
          makeEmail({
            id: 2,
            recipientEmail: 'second@test.com',
            createdAt: new Date('2026-05-30T00:00:01Z'),
          }),
        ],
        { data: { id: 'sent-1' }, error: null },
      );

      const result = await processEmailQueue();

      expect(result.processed).toBe(2);
      expect(result.sent).toBe(2);
      expect(result.failed).toBe(0);
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.from).toHaveBeenCalledWith(emailQueue);
      expect(mockDb.orderBy).toHaveBeenCalledWith(emailQueue.createdAt);
      expect(mockDb.limit).toHaveBeenCalledWith(10);
    });

    it('updates status to sent on successful send', async () => {
      setupDb([makeEmail()], { data: { id: 'sent-1' }, error: null });

      const result = await processEmailQueue();

      expect(result.sent).toBe(1);
      const [row] = mockDb.getRows();
      expect(row.status).toBe('sent');
      expect(row.errorMessage).toBeNull();
      expect(mockDb.update).toHaveBeenCalledWith(emailQueue);
    });

    it('increments attempts and stores error on send failure', async () => {
      setupDb([makeEmail()], new Error('API error'));

      const result = await processEmailQueue();

      expect(result.failed).toBe(1);
      const [row] = mockDb.getRows();
      expect(row.attempts).toBe(1);
      expect(row.status).toBe('pending');
      expect(row.errorMessage).toBe('API error');
      expect(row.lastAttemptAt).toBeInstanceOf(Date);
    });

    it('returns error from Resend response error object', async () => {
      setupDb([makeEmail()], { data: null, error: { message: 'Rate limited' } });

      const result = await processEmailQueue();

      expect(result.failed).toBe(1);
      const [row] = mockDb.getRows();
      expect(row.errorMessage).toBe('Rate limited');
    });

    it('respects backoff and skips emails not yet due for retry', async () => {
      setupDb([makeEmail({ id: 1, attempts: 1, lastAttemptAt: new Date(Date.now() - 5_000) })]);

      const result = await processEmailQueue();

      expect(result.processed).toBe(0);
      expect(mockResendSend).not.toHaveBeenCalled();
      const [row] = mockDb.getRows();
      expect(row.status).toBe('pending');
      expect(row.attempts).toBe(1);
    });

    it('processes email when backoff interval has elapsed', async () => {
      setupDb([makeEmail({ id: 1, attempts: 1, lastAttemptAt: new Date(Date.now() - 60_000) })], {
        data: { id: 'sent-1' },
        error: null,
      });

      const result = await processEmailQueue();

      expect(result.processed).toBe(1);
      expect(result.sent).toBe(1);
      expect(mockResendSend).toHaveBeenCalled();
    });

    it('marks as failed after 3 failed attempts', async () => {
      setupDb(
        [makeEmail({ id: 1, attempts: 2, lastAttemptAt: new Date(Date.now() - 360_000) })],
        new Error('Final error'),
      );

      const result = await processEmailQueue();

      expect(result.failed).toBe(1);
      const [row] = mockDb.getRows();
      expect(row.attempts).toBe(3);
      expect(row.status).toBe('failed');
      expect(row.errorMessage).toBe('Final error');
    });

    it('processes emails with null attempts (default 0)', async () => {
      setupDb([makeEmail({ attempts: null })], new Error('Fail'));

      const result = await processEmailQueue();

      expect(result.failed).toBe(1);
      const [row] = mockDb.getRows();
      expect(row.attempts).toBe(1);
    });

    it('clamps backoff index for attempts >= 3 (30min interval)', async () => {
      setupDb(
        [makeEmail({ id: 1, attempts: 3, lastAttemptAt: new Date(Date.now() - 2_000_000) })],
        { data: { id: 'sent-1' }, error: null },
      );

      const result = await processEmailQueue();

      expect(result.processed).toBe(1);
      expect(result.sent).toBe(1);
    });

    it('reads EMAIL_FROM from getEnv() rather than process.env', async () => {
      vi.mocked(getEnv).mockReturnValueOnce({
        RESEND_API_KEY: 'test-key',
        EMAIL_FROM: 'from-getenv@simak.app',
      } as any);
      const origFrom = process.env.EMAIL_FROM;
      process.env.EMAIL_FROM = 'from-processenv@simak.app';
      setupDb([makeEmail()], { data: { id: 'sent-1' }, error: null });

      await processEmailQueue();

      expect(mockResendSend).toHaveBeenCalled();
      expect(mockResendSend.mock.calls[0]?.[0]?.from).toBe('from-getenv@simak.app');
      process.env.EMAIL_FROM = origFrom;
    });

    it('uses default EMAIL_FROM from getEnv() when not customized', async () => {
      delete process.env.EMAIL_FROM;
      setupDb([makeEmail()], { data: { id: 'sent-1' }, error: null });

      await processEmailQueue();

      expect(mockResendSend).toHaveBeenCalled();
      expect(mockResendSend.mock.calls[0]?.[0]?.from).toBe('SIMAK <noreply@simak.app>');
    });

    it('returns counts when queue is empty', async () => {
      setupDb([]);

      const result = await processEmailQueue();

      expect(result.processed).toBe(0);
      expect(result.sent).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.reclaimed).toBe(0);
      expect(mockResendSend).not.toHaveBeenCalled();
    });

    it('claims pending rows inside a transaction using FOR UPDATE SKIP LOCKED', async () => {
      setupDb([makeEmail({ id: 1 })], { data: { id: 'sent-1' }, error: null });

      await processEmailQueue();

      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      expect(mockDb.for).toHaveBeenCalledWith('update', { skipLocked: true });
    });

    it('marks claimed due rows as processing within the transaction', async () => {
      setupDb([makeEmail({ id: 1 })], { data: { id: 'sent-1' }, error: null });

      await processEmailQueue();

      const txStartIndex = mockDb.calls.findIndex((c) => c.method === 'transaction-start');
      const txEndIndex = mockDb.calls.findIndex((c) => c.method === 'transaction-end');
      expect(txStartIndex).toBeGreaterThan(-1);
      expect(txEndIndex).toBeGreaterThan(txStartIndex);

      const processingSet = mockDb.calls
        .slice(txStartIndex, txEndIndex)
        .find((c) => c.method === 'set' && c.args[0]?.status === 'processing');
      expect(processingSet).toBeTruthy();
    });

    it('sends emails outside the transaction and updates status individually afterward', async () => {
      setupDb([makeEmail({ id: 1 })], { data: { id: 'sent-1' }, error: null });

      const order: string[] = [];
      const origTransaction = mockDb.transaction.getMockImplementation();
      mockDb.transaction.mockImplementation(async (callback) => {
        order.push('transaction-start');
        const result = await (origTransaction as Mock)(callback);
        order.push('transaction-end');
        return result;
      });
      mockResendSend.mockImplementation(async (...args) => {
        order.push('send');
        return { data: { id: 'sent-1' }, error: null };
      });

      await processEmailQueue();

      expect(order).toEqual(['transaction-start', 'transaction-end', 'send']);
      const [row] = mockDb.getRows();
      expect(row.status).toBe('sent');
    });

    it('reclaims stale processing rows back to pending before claiming', async () => {
      const staleTime = new Date(Date.now() - 6 * 60 * 1000);
      setupDb(
        [
          makeEmail({ id: 1, status: 'processing', lastAttemptAt: staleTime }),
          makeEmail({ id: 2, status: 'pending' }),
        ],
        { data: { id: 'sent-1' }, error: null },
      );

      const result = await processEmailQueue();

      expect(result.processed).toBe(2);
      expect(result.sent).toBe(2);
      expect(result.reclaimed).toBe(1);
      expect(mockDb.getRows().every((r) => r.status === 'sent')).toBe(true);

      const reclaimIndex = mockDb.calls.findIndex(
        (c) => c.method === 'set' && c.args[0]?.status === 'pending',
      );
      expect(reclaimIndex).toBeGreaterThan(-1);
      const txStartIndex = mockDb.calls.findIndex((c) => c.method === 'transaction-start');
      expect(reclaimIndex).toBeLessThan(txStartIndex);
    });

    it('does not reclaim fresh processing rows', async () => {
      const freshTime = new Date(Date.now() - 60_000);
      setupDb(
        [
          makeEmail({ id: 1, status: 'processing', lastAttemptAt: freshTime }),
          makeEmail({ id: 2, status: 'pending' }),
        ],
        { data: { id: 'sent-1' }, error: null },
      );

      const result = await processEmailQueue();

      expect(result.processed).toBe(1);
      expect(result.sent).toBe(1);
      expect(result.reclaimed).toBe(0);

      const rows = mockDb.getRows();
      expect(rows.find((r) => r.id === 1)?.status).toBe('processing');
      expect(rows.find((r) => r.id === 2)?.status).toBe('sent');
    });

    it('logs cycle start with due email count', async () => {
      setupDb(
        [makeEmail({ id: 1 }), makeEmail({ id: 2, createdAt: new Date('2026-05-30T00:00:01Z') })],
        { data: { id: 'sent-1' }, error: null },
      );

      await processEmailQueue();

      const cycleStartLog = mockChildLogger.info.mock.calls.find(
        ([arg]: any[]) => arg?.event === 'email_queue.cycle_start',
      );
      expect(cycleStartLog).toBeTruthy();
      expect(cycleStartLog![0]).toMatchObject({
        event: 'email_queue.cycle_start',
        dueCount: 2,
      });
    });

    it('logs cycle end with processed/sent/failed counts', async () => {
      setupDb([makeEmail()], { data: { id: 'sent-1' }, error: null });

      await processEmailQueue();

      const cycleEndLog = mockChildLogger.info.mock.calls.find(
        ([arg]: any[]) => arg?.event === 'email_queue.cycle_end',
      );
      expect(cycleEndLog).toBeTruthy();
      expect(cycleEndLog![0]).toMatchObject({
        event: 'email_queue.cycle_end',
        processed: 1,
        sent: 1,
        failed: 0,
      });
    });

    it('logs stale-row reclamation count', async () => {
      const staleTime = new Date(Date.now() - 6 * 60 * 1000);
      setupDb(
        [
          makeEmail({ id: 1, status: 'processing', lastAttemptAt: staleTime }),
          makeEmail({ id: 2, status: 'pending' }),
        ],
        { data: { id: 'sent-1' }, error: null },
      );

      await processEmailQueue();

      const reclaimLog = mockChildLogger.info.mock.calls.find(
        ([arg]: any[]) => arg?.event === 'email_queue.reclaimed',
      );
      expect(reclaimLog).toBeTruthy();
      expect(reclaimLog![0]).toMatchObject({
        event: 'email_queue.reclaimed',
        count: 1,
      });
    });

    it('logs per-email failure with email id and error but no PII', async () => {
      setupDb(
        [
          makeEmail({
            id: 42,
            recipientEmail: 'secret@user.com',
            subject: 'Secret Subject',
            bodyHtml: '<p>Secret Body</p>',
          }),
        ],
        new Error('Send failed'),
      );

      await processEmailQueue();

      const failLog = mockChildLogger.warn.mock.calls.find(
        ([arg]: any[]) => arg?.event === 'email_queue.send_failed',
      );
      expect(failLog).toBeTruthy();
      expect(failLog![0]).toMatchObject({
        event: 'email_queue.send_failed',
        emailId: 42,
        error: 'Send failed',
      });
      const logJson = JSON.stringify(failLog![0]);
      expect(logJson).not.toContain('secret@user.com');
      expect(logJson).not.toContain('Secret Subject');
      expect(logJson).not.toContain('Secret Body');
    });

    it('populates resendMessageId from result.data.id on successful send', async () => {
      setupDb([makeEmail({ id: 1 })], {
        data: { id: 'resend-msg-abc-123' },
        error: null,
      });

      await processEmailQueue();

      const [row] = mockDb.getRows();
      expect(row.resendMessageId).toBe('resend-msg-abc-123');
    });

    it('leaves resendMessageId null on send failure', async () => {
      setupDb([makeEmail({ id: 1 })], new Error('API error'));

      await processEmailQueue();

      const [row] = mockDb.getRows();
      expect(row.resendMessageId).toBeNull();
    });
  });

  describe('concurrent batch sends (PERF-32/33)', () => {
    it('sends emails in chunks of 5 using Promise.allSettled', async () => {
      const emails = Array.from({ length: 10 }, (_, i) => makeEmail({ id: i + 1 }));
      setupDb(emails);
      let activeCount = 0,
        maxConcurrent = 0;
      mockResendSend.mockImplementation(async () => {
        activeCount++;
        maxConcurrent = Math.max(maxConcurrent, activeCount);
        await new Promise((resolve) => setTimeout(resolve, 10));
        activeCount--;
        return { data: { id: 'sent-1' }, error: null };
      });

      const result = await processEmailQueue();

      expect(maxConcurrent).toBe(5);
      expect(result).toMatchObject({ processed: 10, sent: 10 });
    });

    it('partial failures do not abort the batch', async () => {
      const emails = Array.from({ length: 5 }, (_, i) => makeEmail({ id: i + 1 }));
      setupDb(emails);
      mockResendSend
        .mockResolvedValueOnce({ data: { id: 'sent-1' }, error: null })
        .mockRejectedValueOnce(new Error('Fail'))
        .mockResolvedValueOnce({ data: { id: 'sent-3' }, error: null })
        .mockRejectedValueOnce(new Error('Fail'))
        .mockResolvedValueOnce({ data: { id: 'sent-5' }, error: null });

      const result = await processEmailQueue();

      expect(result).toMatchObject({ processed: 5, sent: 3, failed: 2 });
      expect(mockDb.getRows().map((r) => r.status)).toEqual([
        'sent',
        'pending',
        'sent',
        'pending',
        'sent',
      ]);
    });

    it('processes all emails across multiple chunks with correct status updates', async () => {
      setupDb([
        makeEmail({ id: 1 }),
        makeEmail({ id: 2 }),
        makeEmail({ id: 3, attempts: 2 }),
        makeEmail({ id: 4 }),
        makeEmail({ id: 5 }),
        makeEmail({ id: 6 }),
        makeEmail({ id: 7 }),
      ]);
      mockResendSend
        .mockResolvedValueOnce({ data: { id: 'sent-1' }, error: null })
        .mockRejectedValueOnce(new Error('Fail'))
        .mockRejectedValueOnce(new Error('Final fail'))
        .mockResolvedValueOnce({ data: { id: 'sent-4' }, error: null })
        .mockResolvedValueOnce({ data: { id: 'sent-5' }, error: null })
        .mockRejectedValueOnce(new Error('Fail'))
        .mockResolvedValueOnce({ data: { id: 'sent-7' }, error: null });

      const result = await processEmailQueue();

      expect(result).toMatchObject({ processed: 7, sent: 4, failed: 3 });
      expect(mockDb.getRows().map((r) => r.status)).toEqual([
        'sent',
        'pending',
        'failed',
        'sent',
        'sent',
        'pending',
        'sent',
      ]);
      expect(mockDb.getRows().find((r) => r.id === 3)?.attempts).toBe(3);
    });
  });

  describe('AC-21: EMAIL_FROM source', () => {
    it('uses getEnv().EMAIL_FROM with no process.env fallback', () => {
      const filePath = resolve(__dirname, '../../../src/lib/email-queue-processor.ts');
      const content = readFileSync(filePath, 'utf8');
      expect(content).not.toContain('process.env.EMAIL_FROM');
      expect(content).not.toContain("'SIMAK <noreply@simak.app>'");
    });
  });
});
