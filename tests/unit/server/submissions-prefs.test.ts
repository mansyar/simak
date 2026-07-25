/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { submitCheckpointHandler } from '@/server/submissions.server';
import * as auth from '@/server/auth';
import * as dbMod from '@/db/index';

vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn(),
}));

vi.mock('@/lib/audit', () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/db/index', () => ({
  getDb: vi.fn(),
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

describe('Submission server functions - notification preferences', () => {
  let mockDb: any;
  const studentSession = {
    user: { id: 'student-1', role: 'student' as const },
    session: {} as any,
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
    // Default transaction mock runs the callback with the same mock query builder.
    mockDb.transaction = vi.fn().mockImplementation(async (callback: any) => {
      return callback(mockDb);
    });
    vi.mocked(dbMod.getDb).mockReturnValue(mockDb as any);
  });

  describe('submitCheckpointHandler', () => {
    const submitData = {
      checkpointId: 1,
      fileKey: 'submissions/uuid-123.pdf',
      fileName: 'chapter1.pdf',
      fileSize: 1024,
    };

    it('should skip notification when inApp preference is false', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);

      mockDb.returning.mockReturnValueOnce({
        then: (onfulfilled: any) => Promise.resolve([{ id: 123 }]).then(onfulfilled),
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
        .mockImplementation((onfulfilled: any) =>
          Promise.resolve([
            {
              settings: {
                notificationPrefs: { submission_received: { inApp: false } },
              },
            },
          ]).then(onfulfilled),
        );

      const result = await submitCheckpointHandler({ data: submitData });
      expect(result).toEqual({ success: true });

      // Only the submission INSERT, no notification INSERT
      expect(mockDb.insert).toHaveBeenCalledTimes(1);
      const valuesCalls = vi.mocked(mockDb.values).mock.calls.map((c: any[]) => c[0]);
      const notificationValues = valuesCalls.find((v: any) => v?.type === 'submission_received');
      expect(notificationValues).toBeUndefined();
    });
  });
});
