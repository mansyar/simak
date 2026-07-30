/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { submitReviewHandler } from '@/server/reviews.server';
import * as auth from '@/server/auth';
import * as dbMod from '@/db/index';
import { getObjectContentLength } from '@/lib/storage';
import { isServerError } from '@/lib/errors';

vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn(),
}));

vi.mock('@/db/index', () => ({
  getDb: vi.fn(),
}));

vi.mock('@/lib/audit', () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/storage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/storage')>();
  return {
    ...actual,
    generateFileKey: vi.fn(),
    generatePresignedUploadUrl: vi.fn(),
    generatePresignedDownloadUrl: vi.fn(),
    getObjectContentLength: vi.fn(),
  };
});

vi.mock('@tanstack/react-start', () => ({
  createServerFn: vi.fn().mockReturnValue({
    middleware: vi.fn().mockReturnThis(),
    inputValidator: vi.fn().mockReturnThis(),
    handler: vi.fn().mockImplementation((fn) => fn),
  }),
  createMiddleware: vi.fn().mockReturnValue({
    server: vi.fn().mockImplementation((fn) => fn),
  }),
}));

class MockTx {
  private queue: Array<unknown> = [];
  calls: unknown[] = [];

  enqueue(...results: unknown[]) {
    this.queue.push(...results);
  }

  private proxy(path: unknown[]) {
    return new Proxy(
      {},
      {
        get: (_, prop: string) => {
          if (prop === 'then') {
            return (onFulfilled?: (value: unknown) => unknown) => {
              const result = this.queue.shift();
              this.calls.push({ path, result });
              return Promise.resolve(result).then(onFulfilled);
            };
          }
          return (...args: unknown[]) => this.proxy([...path, prop, ...args.map(String)]);
        },
      },
    );
  }

  select() {
    return this.proxy(['select']);
  }

  insert(table: unknown) {
    return this.proxy(['insert', table]);
  }

  update(table: unknown) {
    return this.proxy(['update', table]);
  }
}

const instructorSession = {
  user: { id: 'instructor-1', name: 'Instructor', role: 'instructor' as const },
  session: {} as any,
};

const baseReviewData = {
  submissionId: 1,
  decision: 'pass' as const,
  comment: 'Good work',
  feedbackFileKey: 'feedback/uuid-123.pdf',
};

function createSubmissionRow(state: string) {
  return {
    checkpointId: 100,
    checkpointState: state,
    checkpointUpdatedAt: new Date(),
    checkpointName: 'Chapter 1',
    checkpointDueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    checkpointOrder: 1,
    assignmentId: 1,
    assignmentTitle: 'Thesis 2026',
    instructorId: 'instructor-1',
    studentId: 'student-1',
    studentName: 'Alice',
    finalDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  };
}

function assertCheckpointReadForUpdate(mockTx: MockTx) {
  const hasForUpdate = mockTx.calls.some((call: any) => {
    const path = (call as { path: string[] }).path;
    return path.some((_, i) => path[i] === 'for' && path[i + 1] === 'update');
  });
  expect(hasForUpdate).toBe(true);
}

describe('submitReviewHandler - upload intent verification', () => {
  let mockTx: MockTx;
  let mockDb: ReturnType<typeof dbMod.getDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockTx = new MockTx();
    mockDb = {
      select: () => mockTx.select(),
      transaction: vi.fn((callback: (tx: MockTx) => Promise<unknown>) => callback(mockTx)),
    } as any;
    vi.mocked(dbMod.getDb).mockReturnValue(mockDb as any);
    vi.mocked(getObjectContentLength).mockResolvedValue({ ok: true, size: 1024 });
  });

  it('AC-H1-1: rejects a fabricated feedback fileKey with no matching intent', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);

    // Locked submission select inside the transaction.
    mockTx.enqueue([createSubmissionRow('under_review')]);
    mockTx.enqueue([]); // intent: none

    const result = await submitReviewHandler({ data: baseReviewData });

    expect(isServerError(result)).toBe(true);
    if (!isServerError(result)) throw new Error('Expected server error');
    expect(result.error.code).toBe('BAD_REQUEST');
    expect(result.error.message).toBe('Invalid or expired upload intent');
    assertCheckpointReadForUpdate(mockTx);
  });

  it('AC-H1-5: rejects review when locked re-read is not in a reviewable state', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);

    mockTx.enqueue([createSubmissionRow('passed')]);

    const result = await submitReviewHandler({ data: baseReviewData });

    expect(isServerError(result)).toBe(true);
    if (!isServerError(result)) throw new Error('Expected server error');
    expect(result.error.code).toBe('BAD_REQUEST');
    expect(result.error.message).toBe('Checkpoint is not in a reviewable state');
    // Only the locked checkpoint read should execute; no upload-intent lookup.
    expect(mockTx.calls.length).toBe(1);
    assertCheckpointReadForUpdate(mockTx);
  });

  it('AC-H1-2: rejects an intent issued for a different instructor', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);

    mockTx.enqueue([createSubmissionRow('under_review')]);
    mockTx.enqueue([
      {
        fileKey: 'feedback/uuid-123.pdf',
        userId: 'instructor-2',
        purpose: 'review_feedback',
        checkpointId: null,
        consumedAt: null,
      },
    ]);

    const result = await submitReviewHandler({ data: baseReviewData });

    expect(isServerError(result)).toBe(true);
    if (!isServerError(result)) throw new Error('Expected server error');
    expect(result.error.code).toBe('BAD_REQUEST');
    expect(result.error.message).toBe('Invalid or expired upload intent');
    assertCheckpointReadForUpdate(mockTx);
  });

  it('AC-H1-3: accepts a valid intent, consumes it, and rejects a second review with same fileKey', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);

    // First review succeeds.
    mockTx.enqueue([createSubmissionRow('under_review')]);
    mockTx.enqueue([
      {
        fileKey: 'feedback/uuid-123.pdf',
        userId: 'instructor-1',
        purpose: 'review_feedback',
        checkpointId: null,
        consumedAt: null,
      },
    ]);
    mockTx.enqueue([]); // consume intent
    mockTx.enqueue([]); // insert reviews
    mockTx.enqueue([]); // update checkpoint
    mockTx.enqueue([{ id: 101 }]); // next checkpoint
    mockTx.enqueue([]); // update next checkpoint
    mockTx.enqueue([]); // insert notification

    const result1 = await submitReviewHandler({ data: baseReviewData });
    expect(result1).toEqual({ success: true });
    assertCheckpointReadForUpdate(mockTx);

    // Second review with same feedback fileKey fails.
    mockTx = new MockTx();
    vi.mocked(dbMod.getDb).mockReturnValue({
      select: () => mockTx.select(),
      transaction: vi.fn((callback: (tx: MockTx) => Promise<unknown>) => callback(mockTx)),
    } as any);
    mockTx.enqueue([createSubmissionRow('under_review')]);
    mockTx.enqueue([]); // intent none

    const result2 = await submitReviewHandler({ data: baseReviewData });

    expect(isServerError(result2)).toBe(true);
    if (!isServerError(result2)) throw new Error('Expected server error');
    expect(result2.error.code).toBe('BAD_REQUEST');
    expect(result2.error.message).toBe('Invalid or expired upload intent');
    assertCheckpointReadForUpdate(mockTx);
  });

  it('AC-H1-4: rejects review feedback whose R2 HEAD Content-Length exceeds 25MB', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
    vi.mocked(getObjectContentLength).mockResolvedValue({ ok: true, size: 25 * 1024 * 1024 + 1 });

    const result = await submitReviewHandler({ data: baseReviewData });

    expect(isServerError(result)).toBe(true);
    if (!isServerError(result)) throw new Error('Expected server error');
    expect(result.error.code).toBe('BAD_REQUEST');
    expect(result.error.message).toBe('File size exceeds 25MB limit');
    expect(getObjectContentLength).toHaveBeenCalledWith({ key: 'feedback/uuid-123.pdf' });
  });

  it('AC-H1-6: returns r2NotConfigured i18n message when R2 is not configured', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
    vi.mocked(getObjectContentLength).mockResolvedValue({ ok: false, reason: 'not_configured' });

    const result = await submitReviewHandler({ data: baseReviewData });

    expect(isServerError(result)).toBe(true);
    if (!isServerError(result)) throw new Error('Expected server error');
    expect(result.error.code).toBe('BAD_REQUEST');
    expect(result.error.message).toBe(
      'File storage is not configured. Contact your administrator.',
    );
  });

  it('AC-H1-7: returns objectNotFound i18n message when R2 object does not exist', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
    vi.mocked(getObjectContentLength).mockResolvedValue({ ok: false, reason: 'not_found' });

    const result = await submitReviewHandler({ data: baseReviewData });

    expect(isServerError(result)).toBe(true);
    if (!isServerError(result)) throw new Error('Expected server error');
    expect(result.error.code).toBe('BAD_REQUEST');
    expect(result.error.message).toBe(
      'The uploaded file could not be found. Please try uploading again.',
    );
  });

  it('BUG-14: should call getObjectContentLength before db.transaction', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
    vi.mocked(getObjectContentLength).mockResolvedValue({ ok: true, size: 1024 });

    const transactionSpy = vi.fn((callback: (tx: MockTx) => Promise<unknown>) => callback(mockTx));
    vi.mocked(dbMod.getDb).mockReturnValue({
      select: () => mockTx.select(),
      transaction: transactionSpy,
    } as any);

    mockTx.enqueue([createSubmissionRow('under_review')]);
    mockTx.enqueue([
      {
        fileKey: 'feedback/uuid-123.pdf',
        userId: 'instructor-1',
        purpose: 'review_feedback',
        checkpointId: null,
        consumedAt: null,
      },
    ]);
    mockTx.enqueue([]); // consume intent
    mockTx.enqueue([]); // insert reviews
    mockTx.enqueue([]); // update checkpoint
    mockTx.enqueue([{ id: 101 }]); // next checkpoint
    mockTx.enqueue([]); // update next checkpoint
    mockTx.enqueue([]); // insert notification

    await submitReviewHandler({ data: baseReviewData });

    expect(getObjectContentLength).toHaveBeenCalledBefore(transactionSpy);
  });
});
