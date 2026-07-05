/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getLatestReviewHandler,
  getReviewDetailHandler,
  openForReviewHandler,
} from '@/server/reviews.server';
import * as auth from '@/server/auth';
import * as dbMod from '@/db/index';
import { checkpoints } from '@/db/schema/assignments';
import { serverError, ErrorCode } from '@/lib/errors';

vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn(),
}));

vi.mock('@/db/index', () => ({
  getDb: vi.fn(),
}));

vi.mock('@/lib/storage', () => ({
  generateFileKey: vi.fn().mockReturnValue('feedback/test-uuid.pdf'),
  generatePresignedUploadUrl: vi.fn().mockResolvedValue('https://presigned-upload.test/url'),
  generatePresignedDownloadUrl: vi.fn().mockResolvedValue('https://presigned-download.test/url'),
  getR2Client: vi.fn().mockReturnValue({}),
}));

describe('Review handlers - Queries (getLatestReview, getReviewDetail)', () => {
  let mockDb: any;
  let mockTx: any;
  const instructorSession = {
    user: { id: 'instructor-1', role: 'instructor' as const },
    session: {} as any,
  };
  const studentSession = {
    user: { id: 'student-1', role: 'student' as const },
    session: {} as any,
  };
  const otherInstructorSession = {
    user: { id: 'instructor-2', role: 'instructor' as const },
    session: {} as any,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockTx = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      for: vi.fn().mockReturnThis(),
      then: vi.fn((onfulfilled: any) => Promise.resolve([]).then(onfulfilled)),
    };

    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      distinctOn: vi.fn().mockReturnThis(),
      transaction: vi.fn((cb: (tx: any) => Promise<any>) => cb(mockTx)),
      then: vi.fn((onfulfilled: any) => Promise.resolve([]).then(onfulfilled)),
    };
    vi.mocked(dbMod.getDb).mockReturnValue(mockDb as any);
  });

  describe('getLatestReviewHandler', () => {
    it('should return the most recent review for a student checkpoint', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);
      // First query: ownership check (returns a checkpoint row)
      mockDb.then
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ id: 100 }]).then(onfulfilled),
        )
        // Second query: review fetch
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([
            {
              id: 10,
              decision: 'revise',
              comment: 'Needs improvement',
              instructorName: 'Dr. Smith',
              createdAt: new Date('2026-05-23'),
              revisionDeadline: new Date('2026-06-01'),
            },
          ]).then(onfulfilled),
        );
      const result = (await getLatestReviewHandler({ data: { checkpointId: 100 } })) as any;
      expect(result.review).toBeDefined();
      expect(result.review.decision).toBe('revise');
    });

    it('should return the most recent review for an instructor-owned checkpoint', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
      // First query: ownership check (returns a checkpoint row)
      mockDb.then
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ id: 100 }]).then(onfulfilled),
        )
        // Second query: review fetch
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([
            {
              id: 10,
              decision: 'pass',
              comment: 'Well done',
              instructorName: 'Dr. Smith',
              createdAt: new Date('2026-05-23'),
            },
          ]).then(onfulfilled),
        );
      const result = (await getLatestReviewHandler({ data: { checkpointId: 100 } })) as any;
      expect(result.review).toBeDefined();
      expect(result.review.decision).toBe('pass');
    });

    it('should return null if no review exists', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);
      // First query: ownership check (returns a checkpoint row)
      mockDb.then
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ id: 999 }]).then(onfulfilled),
        )
        // Second query: no review found
        .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled));
      const result = (await getLatestReviewHandler({ data: { checkpointId: 999 } })) as any;
      expect(result.review).toBeNull();
    });

    it('should reject if student does not own the checkpoint', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);
      // Ownership check returns empty (checkpoint not assigned to this student)
      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([]).then(onfulfilled),
      );
      const result = await getLatestReviewHandler({ data: { checkpointId: 100 } });
      expect(result).toEqual(serverError(ErrorCode.NOT_FOUND, 'Checkpoint not found'));
    });

    it('should reject if instructor does not own the checkpoint', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(otherInstructorSession as any);
      // Ownership check returns empty (checkpoint belongs to another instructor)
      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([]).then(onfulfilled),
      );
      const result = await getLatestReviewHandler({ data: { checkpointId: 100 } });
      expect(result).toEqual(serverError(ErrorCode.NOT_FOUND, 'Checkpoint not found'));
    });

    it('should reject if unauthorized', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);
      const result = await getLatestReviewHandler({ data: { checkpointId: 1 } });
      expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
    });
  });

  describe('getReviewDetailHandler', () => {
    it('should reject if unauthorized', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);
      const result = await getReviewDetailHandler({ data: { submissionId: 1 } });
      expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
    });

    it('should return submission detail with download URL and review history', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
      mockDb.then
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([
            {
              submissionId: 1,
              checkpointId: 100,
              checkpointName: 'Chapter 1',
              assignmentId: 1,
              assignmentTitle: 'Thesis 2026',
              instructorId: 'instructor-1',
              studentId: 'student-1',
              studentName: 'Alice',
              fileKey: 'submissions/uuid.pdf',
              fileName: 'chapter1.pdf',
              fileSize: 2048,
              version: 2,
              uploadedAt: new Date('2026-05-22'),
              checkpointState: 'under_review',
              checkpointUpdatedAt: new Date('2026-05-22'),
            },
          ]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([
            {
              id: 5,
              decision: 'revise',
              comment: 'Fix formatting',
              instructorName: 'Dr. Smith',
              createdAt: new Date('2026-05-21'),
            },
          ]).then(onfulfilled),
        );
      const result = (await getReviewDetailHandler({ data: { submissionId: 1 } })) as any;
      expect(result).toHaveProperty('submission');
      expect(result).toHaveProperty('reviewHistory');
      expect(result.reviewHistory).toHaveLength(1);
    });

    it('should return error for non-existent submission', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([]).then(onfulfilled),
      );
      const result = await getReviewDetailHandler({ data: { submissionId: 999 } });
      expect(result).toEqual({ error: { code: 'NOT_FOUND', message: 'Submission not found' } });
    });
  });

  describe('openForReviewHandler', () => {
    it('should reject if unauthorized', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);
      const result = await openForReviewHandler({ data: { submissionId: 1 } });
      expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
    });

    it('should transition submitted to under_review with SELECT FOR UPDATE inside a transaction', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
      mockTx.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([
          {
            checkpointId: 100,
            checkpointState: 'submitted',
            assignmentId: 1,
            instructorId: 'instructor-1',
          },
        ]).then(onfulfilled),
      );

      const result = await openForReviewHandler({ data: { submissionId: 1 } });

      expect(result).toEqual({ success: true });
      expect(mockDb.transaction).toHaveBeenCalled();
      expect(mockTx.for).toHaveBeenCalledWith('update');
      expect(mockTx.update).toHaveBeenCalledWith(checkpoints);
      expect(mockTx.set).toHaveBeenCalledWith({
        state: 'under_review',
        updatedAt: expect.any(Date),
      });
    });

    it('should reject if locked re-read shows a non-submitted state', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
      mockTx.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([
          {
            checkpointId: 100,
            checkpointState: 'passed',
            assignmentId: 1,
            instructorId: 'instructor-1',
          },
        ]).then(onfulfilled),
      );

      const result = await openForReviewHandler({ data: { submissionId: 1 } });

      expect(result).toEqual({
        error: {
          code: 'BAD_REQUEST',
          message: 'Checkpoint must be in submitted state to open for review',
        },
      });
      expect(mockTx.update).not.toHaveBeenCalled();
    });

    it('should return error for non-existent submission', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);

      const result = await openForReviewHandler({ data: { submissionId: 999 } });

      expect(result).toEqual({ error: { code: 'NOT_FOUND', message: 'Submission not found' } });
      expect(mockTx.update).not.toHaveBeenCalled();
    });
  });
});
