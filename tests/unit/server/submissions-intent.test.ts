/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { submitCheckpointHandler } from '@/server/submissions.server';
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

vi.mock('@/lib/storage', () => ({
  generateFileKey: vi.fn(),
  generatePresignedUploadUrl: vi.fn(),
  generatePresignedDownloadUrl: vi.fn(),
  getObjectContentLength: vi.fn(),
}));

vi.mock('@tanstack/react-start', () => ({
  createServerFn: vi.fn().mockReturnValue({
    inputValidator: vi.fn().mockReturnThis(),
    handler: vi.fn().mockImplementation((fn) => fn),
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

const studentSession = {
  user: { id: 'student-1', name: 'Student', role: 'student' as const },
  session: {} as any,
};

describe('submitCheckpointHandler - upload intent verification', () => {
  let mockTx: MockTx;
  const baseSubmitData = {
    checkpointId: 1,
    fileKey: 'submissions/uuid-123.pdf',
    fileName: 'chapter1.pdf',
    fileSize: 1024,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockTx = new MockTx();
    vi.mocked(dbMod.getDb).mockReturnValue({
      transaction: vi.fn((callback: (tx: MockTx) => Promise<unknown>) => callback(mockTx)),
    } as any);
    vi.mocked(getObjectContentLength).mockResolvedValue(1024);
  });

  it('AC-H1-1: rejects a fabricated fileKey with no matching intent', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);

    mockTx.enqueue(
      [{ id: 1, assignmentId: 101, studentId: 'student-1', state: 'unlocked' }], // checkpoint
      [], // intent: none
    );

    const result = await submitCheckpointHandler({ data: baseSubmitData });

    expect(isServerError(result)).toBe(true);
    if (!isServerError(result)) throw new Error('Expected server error');
    expect(result.error.code).toBe('BAD_REQUEST');
    expect(result.error.message).toBe('Invalid or expired upload intent');
  });

  it('AC-H1-2: rejects an intent issued for a different checkpoint', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);

    mockTx.enqueue(
      [{ id: 1, assignmentId: 101, studentId: 'student-1', state: 'unlocked' }], // checkpoint
      [
        {
          fileKey: 'submissions/uuid-123.pdf',
          userId: 'student-1',
          purpose: 'submission',
          checkpointId: 999,
          consumedAt: null,
        },
      ], // intent: wrong checkpoint
    );

    const result = await submitCheckpointHandler({ data: baseSubmitData });

    expect(isServerError(result)).toBe(true);
    if (!isServerError(result)) throw new Error('Expected server error');
    expect(result.error.code).toBe('BAD_REQUEST');
    expect(result.error.message).toBe('Invalid or expired upload intent');
  });

  it('AC-H1-2: rejects an intent issued for a different purpose', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);

    mockTx.enqueue(
      [{ id: 1, assignmentId: 101, studentId: 'student-1', state: 'unlocked' }], // checkpoint
      [
        {
          fileKey: 'submissions/uuid-123.pdf',
          userId: 'student-1',
          purpose: 'review_feedback',
          checkpointId: 1,
          consumedAt: null,
        },
      ], // intent: wrong purpose
    );

    const result = await submitCheckpointHandler({ data: baseSubmitData });

    expect(isServerError(result)).toBe(true);
    if (!isServerError(result)) throw new Error('Expected server error');
    expect(result.error.code).toBe('BAD_REQUEST');
    expect(result.error.message).toBe('Invalid or expired upload intent');
  });

  it('AC-H1-2: rejects an intent issued for a different user', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);

    mockTx.enqueue(
      [{ id: 1, assignmentId: 101, studentId: 'student-1', state: 'unlocked' }], // checkpoint
      [
        {
          fileKey: 'submissions/uuid-123.pdf',
          userId: 'student-2',
          purpose: 'submission',
          checkpointId: 1,
          consumedAt: null,
        },
      ], // intent: wrong user
    );

    const result = await submitCheckpointHandler({ data: baseSubmitData });

    expect(isServerError(result)).toBe(true);
    if (!isServerError(result)) throw new Error('Expected server error');
    expect(result.error.code).toBe('BAD_REQUEST');
    expect(result.error.message).toBe('Invalid or expired upload intent');
  });

  it('AC-H1-3: accepts a valid intent, consumes it, and rejects a second submit', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);

    // First submit succeeds.
    mockTx.enqueue(
      [{ id: 1, assignmentId: 101, studentId: 'student-1', state: 'unlocked' }], // checkpoint
      [
        {
          fileKey: 'submissions/uuid-123.pdf',
          userId: 'student-1',
          purpose: 'submission',
          checkpointId: 1,
          consumedAt: null,
        },
      ], // intent valid
      [], // consume intent
      [{ maxVersion: 0 }], // version
      [{ id: 42 }], // insert submission
      [], // update checkpoint
      [{ instructorId: 'instructor-1', assignmentTitle: 'Thesis 2026' }], // assignment
      [], // insert notification
    );

    const result1 = await submitCheckpointHandler({ data: baseSubmitData });
    expect(result1).toEqual({ success: true });

    // Second submit with same fileKey fails because the intent is consumed.
    mockTx.enqueue(
      [{ id: 1, assignmentId: 101, studentId: 'student-1', state: 'unlocked' }], // checkpoint
      [], // intent: none (consumed)
    );

    const result2 = await submitCheckpointHandler({ data: baseSubmitData });

    expect(isServerError(result2)).toBe(true);
    if (!isServerError(result2)) throw new Error('Expected server error');
    expect(result2.error.code).toBe('BAD_REQUEST');
    expect(result2.error.message).toBe('Invalid or expired upload intent');
  });

  it('AC-H1-4: rejects a file whose R2 HEAD Content-Length exceeds 25MB', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);
    vi.mocked(getObjectContentLength).mockResolvedValue(25 * 1024 * 1024 + 1);

    mockTx.enqueue(
      [{ id: 1, assignmentId: 101, studentId: 'student-1', state: 'unlocked' }], // checkpoint
      [
        {
          fileKey: 'submissions/uuid-123.pdf',
          userId: 'student-1',
          purpose: 'submission',
          checkpointId: 1,
          consumedAt: null,
        },
      ], // intent valid
      // No further queries because HEAD rejects before insert.
    );

    const result = await submitCheckpointHandler({ data: baseSubmitData });

    expect(isServerError(result)).toBe(true);
    if (!isServerError(result)) throw new Error('Expected server error');
    expect(result.error.code).toBe('BAD_REQUEST');
    expect(result.error.message).toBe('File size exceeds 25MB limit');
    expect(getObjectContentLength).toHaveBeenCalledWith({ key: 'submissions/uuid-123.pdf' });
  });
});
