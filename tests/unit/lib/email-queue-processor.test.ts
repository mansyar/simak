import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
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

// --- Mock DB that tracks rows and records calls ---

type FakeStatus = 'pending' | 'processing' | 'sent' | 'failed';

interface FakeRow {
  id: number;
  recipientEmail: string;
  subject: string;
  bodyHtml: string;
  templateType: string;
  status: FakeStatus;
  attempts: number | null;
  lastAttemptAt: Date | null;
  errorMessage: string | null;
  createdAt: Date;
}

interface CallRecord {
  method: string;
  args: any[];
}

interface MockDb {
  select: Mock;
  from: Mock;
  where: Mock;
  orderBy: Mock;
  limit: Mock;
  for: Mock;
  update: Mock;
  set: Mock;
  then: Mock;
  transaction: Mock;
  calls: CallRecord[];
  getRows: () => FakeRow[];
}

function snakeToCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

function compareValues(a: any, b: any, op: string): boolean {
  const aVal = a instanceof Date ? a.getTime() : a;
  const bVal = b instanceof Date ? b.getTime() : b;
  if (op === '=') return aVal === bVal;
  if (op === '<') return aVal < bVal;
  if (op === '>') return aVal > bVal;
  return true;
}

function evaluateCondition(condition: any, row: FakeRow): boolean {
  const chunks = condition?.queryChunks;
  if (!chunks) return true;

  if (chunks.length === 3 && chunks[0]?.value?.[0] === '(' && chunks[2]?.value?.[0] === ')') {
    return evaluateCondition(chunks[1], row);
  }

  if (chunks.length === 3) {
    const joiner: string | undefined = chunks[1]?.value?.[0];
    if (typeof joiner === 'string') {
      const left = evaluateCondition(chunks[0], row);
      const right = evaluateCondition(chunks[2], row);
      if (joiner.includes(' and ')) return left && right;
      if (joiner.includes(' or ')) return left || right;
    }
  }

  if (chunks.length === 5) {
    const left = chunks[1];
    const opRaw: string | undefined = chunks[2]?.value?.[0];
    const right = chunks[3]?.value;
    const op = typeof opRaw === 'string' ? opRaw.trim() : undefined;
    if (left?.name && op) {
      const rowVal = (row as any)[snakeToCamel(left.name)];
      return compareValues(rowVal, right, op);
    }
  }

  return true;
}

function createMockDb(rows: FakeRow[] = []): MockDb {
  let currentRows: FakeRow[] = [];
  let pendingSetValues: any = null;
  const calls: CallRecord[] = [];

  const mockDb: Record<string, any> = {
    select: vi.fn(() => {
      calls.push({ method: 'select', args: [] });
      return mockDb;
    }),
    from: vi.fn((table) => {
      calls.push({ method: 'from', args: [table] });
      currentRows = [...rows];
      return mockDb;
    }),
    where: vi.fn((condition) => {
      calls.push({ method: 'where', args: [condition] });
      currentRows = currentRows.filter((row) => evaluateCondition(condition, row));
      if (pendingSetValues !== null) {
        currentRows.forEach((row) => Object.assign(row, pendingSetValues));
        pendingSetValues = null;
      }
      return mockDb;
    }),
    orderBy: vi.fn((col) => {
      calls.push({ method: 'orderBy', args: [col] });
      currentRows.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      return mockDb;
    }),
    limit: vi.fn((n) => {
      calls.push({ method: 'limit', args: [n] });
      currentRows = currentRows.slice(0, n);
      return mockDb;
    }),
    for: vi.fn((...args) => {
      calls.push({ method: 'for', args });
      return mockDb;
    }),
    update: vi.fn((table) => {
      calls.push({ method: 'update', args: [table] });
      pendingSetValues = null;
      currentRows = [...rows];
      return mockDb;
    }),
    set: vi.fn((values) => {
      calls.push({ method: 'set', args: [values] });
      pendingSetValues = values;
      return mockDb;
    }),
    then: vi.fn((onFulfilled) => Promise.resolve(currentRows).then(onFulfilled)),
    transaction: vi.fn(async (callback) => {
      calls.push({ method: 'transaction-start', args: [] });
      const result = await callback(mockDb);
      calls.push({ method: 'transaction-end', args: [] });
      return result;
    }),
  };

  mockDb.calls = calls;
  mockDb.getRows = () => rows;

  return mockDb as MockDb;
}

function makeEmail(
  overrides: Partial<{
    id: number;
    recipientEmail: string;
    subject: string;
    bodyHtml: string;
    templateType: string;
    status: FakeStatus;
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
    status: 'pending' as FakeStatus,
    attempts: 0,
    lastAttemptAt: null,
    errorMessage: null,
    createdAt: new Date('2026-05-30T00:00:00Z'),
    ...overrides,
  };
}

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

    it('uses custom EMAIL_FROM env var when set', async () => {
      const origFrom = process.env.EMAIL_FROM;
      process.env.EMAIL_FROM = 'custom@simak.app';
      setupDb([makeEmail()], { data: { id: 'sent-1' }, error: null });

      await processEmailQueue();

      expect(mockResendSend).toHaveBeenCalled();
      expect(mockResendSend.mock.calls[0]?.[0]?.from).toBe('custom@simak.app');
      process.env.EMAIL_FROM = origFrom;
    });

    it('returns counts when queue is empty', async () => {
      setupDb([]);

      const result = await processEmailQueue();

      expect(result.processed).toBe(0);
      expect(result.sent).toBe(0);
      expect(result.failed).toBe(0);
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

      const rows = mockDb.getRows();
      expect(rows.find((r) => r.id === 1)?.status).toBe('processing');
      expect(rows.find((r) => r.id === 2)?.status).toBe('sent');
    });
  });
});
