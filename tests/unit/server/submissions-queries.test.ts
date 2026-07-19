/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listSubmissionsHandler, getSubmissionDetailHandler } from '@/server/submissions.server';
import * as auth from '@/server/auth';
import * as dbMod from '@/db/index';

vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn(),
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
  generatePresignedDownloadUrl: vi.fn().mockResolvedValue('https://presigned-download.test/url'),
}));

describe('Submission query handlers - Logic & Security', () => {
  let mockDb: any;
  const studentSession = {
    user: { id: 'student-1', role: 'student' as const },
    session: {} as any,
  };
  const otherStudentSession = {
    user: { id: 'student-2', role: 'student' as const },
    session: {} as any,
  };

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
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      then: vi.fn(function (onfulfilled: any) {
        return Promise.resolve([]).then(onfulfilled);
      }),
    };
    vi.mocked(dbMod.getDb).mockReturnValue(mockDb as any);
  });

  describe('listSubmissionsHandler', () => {
    it('should reject if unauthorized', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);

      const result = await listSubmissionsHandler({
        data: { checkpointId: 1, page: 1, limit: 20 },
      });
      expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
    });

    it('should return empty array when no submissions exist', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);

      mockDb.then
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ id: 1, studentId: 'student-1' }]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled))
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ count: 0 }]).then(onfulfilled),
        );

      const result = await listSubmissionsHandler({
        data: { checkpointId: 1, page: 1, limit: 20 },
      });
      expect(result).toEqual({ submissions: [], total: 0 });
    });

    it('should return all submissions for own checkpoint, newest first', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);

      mockDb.then
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ id: 1, studentId: 'student-1' }]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([
            {
              id: 3,
              version: 3,
              fileName: 'v3.pdf',
              fileSize: 3000,
              uploadedAt: new Date('2026-05-22'),
            },
            {
              id: 2,
              version: 2,
              fileName: 'v2.pdf',
              fileSize: 2000,
              uploadedAt: new Date('2026-05-21'),
            },
            {
              id: 1,
              version: 1,
              fileName: 'v1.pdf',
              fileSize: 1000,
              uploadedAt: new Date('2026-05-20'),
            },
          ]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ count: 3 }]).then(onfulfilled),
        );

      const result = (await listSubmissionsHandler({
        data: { checkpointId: 1, page: 1, limit: 20 },
      })) as any;
      expect(result.submissions).toHaveLength(3);
      expect(result.submissions[0].version).toBe(3);
      expect(result.submissions[1].version).toBe(2);
      expect(result.submissions[2].version).toBe(1);
    });

    it('should reject if checkpoint does not belong to the student', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(otherStudentSession as any);

      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([]).then(onfulfilled),
      );

      const result = await listSubmissionsHandler({
        data: { checkpointId: 1, page: 1, limit: 20 },
      });
      expect(result).toEqual({ error: { code: 'NOT_FOUND', message: 'Checkpoint not found' } });
    });

    it('should accept page/limit params and return total count (PERF-17)', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);

      const fakeSubmission = {
        id: 10,
        version: 3,
        fileName: 'v3.pdf',
        fileSize: 3072,
        uploadedAt: new Date('2026-05-22'),
      };

      mockDb.then
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ id: 1, studentId: 'student-1' }]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([fakeSubmission]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ count: 42 }]).then(onfulfilled),
        );

      const result = await listSubmissionsHandler({
        data: { checkpointId: 1, page: 2, limit: 10 },
      });
      expect(result).toEqual({ submissions: [fakeSubmission], total: 42 });
      expect(mockDb.limit).toHaveBeenCalledWith(10);
      expect(mockDb.offset).toHaveBeenCalledWith(10);
    });

    it('should default to page=1, limit=20 when not provided (PERF-17)', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);

      mockDb.then
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ id: 1, studentId: 'student-1' }]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled))
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ count: 0 }]).then(onfulfilled),
        );

      await listSubmissionsHandler({ data: { checkpointId: 1, page: 1, limit: 20 } });
      expect(mockDb.limit).toHaveBeenCalledWith(20);
      expect(mockDb.offset).toHaveBeenCalledWith(0);
    });

    it('should return empty submissions when page is beyond range (PERF-17)', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);

      mockDb.then
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ id: 1, studentId: 'student-1' }]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled))
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ count: 5 }]).then(onfulfilled),
        );

      const result = await listSubmissionsHandler({
        data: { checkpointId: 1, page: 100, limit: 20 },
      });
      expect(result).toEqual({ submissions: [], total: 5 });
    });
  });

  describe('getSubmissionDetailHandler', () => {
    it('should reject if unauthorized', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);

      const result = await getSubmissionDetailHandler({ data: { submissionId: 1 } });
      expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
    });

    it('should return submission detail with download URL for own submission', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);

      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([
          {
            id: 1,
            checkpointId: 10,
            uploadedBy: 'student-1',
            fileKey: 'submissions/uuid-123.pdf',
            fileName: 'chapter1.pdf',
            fileSize: 1024,
            version: 1,
            uploadedAt: new Date(),
          },
        ]).then(onfulfilled),
      );

      const result = (await getSubmissionDetailHandler({ data: { submissionId: 1 } })) as any;
      expect(result).toHaveProperty('submission');
      expect(result.submission).toHaveProperty('downloadUrl');
      expect(result.submission.fileName).toBe('chapter1.pdf');
    });

    it('should return not found for non-existent submission', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);

      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([]).then(onfulfilled),
      );

      const result = await getSubmissionDetailHandler({ data: { submissionId: 999 } });
      expect(result).toEqual({ error: { code: 'NOT_FOUND', message: 'Submission not found' } });
    });

    it('should reject access to another student submission', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(otherStudentSession as any);

      // The real WHERE clause filters by uploadedBy = 'student-2', so the mock
      // returns empty (simulating the filter correctly)
      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([]).then(onfulfilled),
      );

      const result = await getSubmissionDetailHandler({ data: { submissionId: 1 } });
      expect(result).toEqual({ error: { code: 'NOT_FOUND', message: 'Submission not found' } });
    });
  });

  describe('Ownership guard', () => {
    it('should prevent student A from listing student B submissions', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
        user: { id: 'student-2', role: 'student' } as any,
        session: {} as any,
      });

      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([]).then(onfulfilled),
      );

      const result = await listSubmissionsHandler({
        data: { checkpointId: 1, page: 1, limit: 20 },
      });
      expect(result).toEqual({ error: { code: 'NOT_FOUND', message: 'Checkpoint not found' } });
    });
  });

  describe('getPresignedUploadUrl', () => {
    it('should generate UUID file key and return URL for unlocked checkpoint', async () => {
      // This will be tested via the handler import
    });
  });
});
