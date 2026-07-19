/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { submitCheckpointHandler } from '@/server/submissions.server';
import { isServerError } from '@/lib/errors';
import * as auth from '@/server/auth';
import * as dbMod from '@/db/index';
import * as audit from '@/lib/audit';

vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn(),
}));

vi.mock('@/db/index', () => ({
  getDb: vi.fn(),
}));

vi.mock('@/lib/audit', () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@tanstack/react-start', () => ({
  createServerFn: vi.fn().mockReturnValue({
    inputValidator: vi.fn().mockReturnThis(),
    handler: vi.fn().mockImplementation((fn) => fn),
  }),
}));

vi.mock('@/lib/storage', () => ({
  generateFileKey: vi.fn().mockReturnValue('submissions/test-uuid.pdf'),
  generatePresignedUploadUrl: vi.fn().mockResolvedValue('https://presigned-upload.test/url'),
  generatePresignedDownloadUrl: vi.fn().mockResolvedValue('https://presigned-download.test/url'),
  getR2Client: vi.fn().mockReturnValue({}),
  getObjectContentLength: vi.fn().mockResolvedValue({ ok: true, size: 1024 }),
}));

describe('submitCheckpointHandler — transactions & metadata', () => {
  let mockDb: any;
  const studentSession = {
    user: { id: 'student-1', role: 'student' as const, name: 'Student One' },
    session: {} as any,
  };

  const submitData = {
    checkpointId: 1,
    fileKey: 'submissions/uuid-123.pdf',
    fileName: 'chapter1.pdf',
    fileSize: 1024,
  };

  const validIntentRow = {
    fileKey: 'submissions/uuid-123.pdf',
    userId: 'student-1',
    purpose: 'submission',
    checkpointId: 1,
    consumedAt: null,
  };

  function enqueueIntentSuccess(db: any) {
    db.then
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([validIntentRow]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled));
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      for: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      then: vi.fn(function (onfulfilled: any) {
        return Promise.resolve([]).then(onfulfilled);
      }),
    };
    mockDb.transaction = vi.fn().mockImplementation(async (callback: any) => {
      return callback(mockDb);
    });
    vi.mocked(dbMod.getDb).mockReturnValue(mockDb as any);
  });

  it('should wrap all writes inside db.transaction using tx', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);

    mockDb.then.mockImplementationOnce((onfulfilled: any) =>
      Promise.resolve([
        { id: 1, assignmentId: 101, studentId: 'student-1', state: 'unlocked' },
      ]).then(onfulfilled),
    );

    enqueueIntentSuccess(mockDb);
    mockDb.then.mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled));

    await submitCheckpointHandler({ data: submitData });

    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    const txArg = vi.mocked(mockDb.transaction).mock.calls[0][0];
    expect(typeof txArg).toBe('function');
  });

  it('should use .returning({ id: submissions.id }) and store real submission id in metadata', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);

    mockDb.returning.mockReturnValueOnce({
      then: (onfulfilled: any) => Promise.resolve([{ id: 42 }]).then(onfulfilled),
    });

    mockDb.then.mockImplementationOnce((onfulfilled: any) =>
      Promise.resolve([
        { id: 1, assignmentId: 101, studentId: 'student-1', state: 'unlocked' },
      ]).then(onfulfilled),
    );

    enqueueIntentSuccess(mockDb);
    mockDb.then
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ instructorId: 'instructor-1', assignmentTitle: 'Thesis 2026' }]).then(
          onfulfilled,
        ),
      );

    await submitCheckpointHandler({ data: submitData });

    expect(mockDb.returning).toHaveBeenCalled();
    const returningArg = vi.mocked(mockDb.returning).mock.calls[0][0];
    expect(returningArg).toHaveProperty('id');

    const valuesCalls = vi.mocked(mockDb.values).mock.calls;
    const notificationValues = valuesCalls[valuesCalls.length - 1][0];
    expect(notificationValues.metadata.submissionId).toBe(42);
  });

  it('should not put version number in notification metadata', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);

    mockDb.returning.mockReturnValueOnce({
      then: (onfulfilled: any) => Promise.resolve([{ id: 99 }]).then(onfulfilled),
    });

    mockDb.then.mockImplementationOnce((onfulfilled: any) =>
      Promise.resolve([
        { id: 1, assignmentId: 101, studentId: 'student-1', state: 'unlocked' },
      ]).then(onfulfilled),
    );

    enqueueIntentSuccess(mockDb);
    mockDb.then
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ maxVersion: 3 }]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ instructorId: 'instructor-1', assignmentTitle: 'Thesis 2026' }]).then(
          onfulfilled,
        ),
      );

    await submitCheckpointHandler({ data: submitData });

    const valuesCalls = vi.mocked(mockDb.values).mock.calls;
    const notificationValues = valuesCalls[valuesCalls.length - 1][0];
    expect(notificationValues.metadata.submissionId).toBe(99);
    expect(notificationValues.metadata.submissionId).not.toBe(4);
  });

  it('should return success when post-commit audit log fails', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);
    vi.mocked(audit.logAuditEvent).mockRejectedValueOnce(new Error('Audit log failure'));

    mockDb.returning.mockReturnValueOnce({
      then: (onfulfilled: any) => Promise.resolve([{ id: 77 }]).then(onfulfilled),
    });

    mockDb.then.mockImplementationOnce((onfulfilled: any) =>
      Promise.resolve([
        { id: 1, assignmentId: 101, studentId: 'student-1', state: 'unlocked' },
      ]).then(onfulfilled),
    );

    enqueueIntentSuccess(mockDb);
    mockDb.then
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ instructorId: 'instructor-1', assignmentTitle: 'Thesis 2026' }]).then(
          onfulfilled,
        ),
      );

    const result = await submitCheckpointHandler({ data: submitData });

    expect(result).toEqual({ success: true });
    expect(audit.logAuditEvent).toHaveBeenCalled();
  });

  it('should rollback transaction when notification insert fails', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);

    mockDb.returning.mockReturnValueOnce({
      then: (onfulfilled: any) => Promise.resolve([{ id: 55 }]).then(onfulfilled),
    });

    mockDb.then.mockImplementationOnce((onfulfilled: any) =>
      Promise.resolve([
        { id: 1, assignmentId: 101, studentId: 'student-1', state: 'unlocked' },
      ]).then(onfulfilled),
    );

    enqueueIntentSuccess(mockDb);
    mockDb.then
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ instructorId: 'instructor-1', assignmentTitle: 'Thesis 2026' }]).then(
          onfulfilled,
        ),
      )
      .mockImplementationOnce((onfulfilled: any, onrejected: any) => {
        const err = new Error('notification insert failure');
        if (onrejected) onrejected(err);
        return Promise.reject(err);
      });

    const result = await submitCheckpointHandler({ data: submitData });

    expect(result).toHaveProperty('error');
    expect(isServerError(result)).toBe(true);
    if (!isServerError(result)) throw new Error('Expected server error');
    expect(result.error.code).toBe('INTERNAL');
  });
});
