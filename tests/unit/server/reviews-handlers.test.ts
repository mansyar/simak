/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listPendingReviewsHandler, submitReviewHandler } from '@/server/reviews.server';
import { adjustDeadlinesForBreach, dispatchSLABreachNotifications } from '@/lib/review-sla';
import { checkpoints } from '@/db/schema/assignments';
import * as auth from '@/server/auth';
import * as dbMod from '@/db/index';

vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn(),
}));

vi.mock('@/db/index', () => ({
  getDb: vi.fn(),
}));

vi.mock('@/lib/review-sla', () => ({
  adjustDeadlinesForBreach: vi.fn(),
  dispatchSLABreachNotifications: vi.fn(),
}));

vi.mock('@/lib/storage', () => ({
  generateFileKey: vi.fn().mockReturnValue('feedback/test-uuid.pdf'),
  generatePresignedUploadUrl: vi.fn().mockResolvedValue('https://presigned-upload.test/url'),
  generatePresignedDownloadUrl: vi.fn().mockResolvedValue('https://presigned-download.test/url'),
  getR2Client: vi.fn().mockReturnValue({}),
}));

describe('Review handlers - Logic & Security', () => {
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
      for: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
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

  describe('listPendingReviewsHandler', () => {
    it('should reject if unauthorized', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);
      const result = await listPendingReviewsHandler({ data: { page: 1, limit: 20 } });
      expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
    });

    it('should reject if not an instructor', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);
      const result = await listPendingReviewsHandler({ data: { page: 1, limit: 20 } });
      expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
    });

    it('should return empty list when no pending submissions', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
      mockDb.then
        .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled))
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ count: 0 }]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled));
      const result = (await listPendingReviewsHandler({ data: { page: 1, limit: 20 } })) as any;
      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should return pending submissions FIFO for instructor assignments', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
      mockDb.then
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ id: 1 }, { id: 2 }]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ count: 2 }]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([
            {
              submissionId: 10,
              checkpointId: 100,
              checkpointName: 'Chapter 1',
              assignmentId: 1,
              assignmentTitle: 'Thesis 2026',
              studentId: 'student-1',
              studentName: 'Alice',
              fileName: 'chapter1.pdf',
              fileSize: 2048,
              fileKey: 'submissions/uuid-1.pdf',
              version: 1,
              uploadedAt: new Date('2026-05-20'),
              checkpointState: 'submitted',
              checkpointUpdatedAt: new Date('2026-05-20'),
            },
            {
              submissionId: 11,
              checkpointId: 101,
              checkpointName: 'Introduction',
              assignmentId: 2,
              assignmentTitle: 'Research Paper',
              studentId: 'student-2',
              studentName: 'Bob',
              fileName: 'intro.pdf',
              fileSize: 1024,
              fileKey: 'submissions/uuid-2.pdf',
              version: 2,
              uploadedAt: new Date('2026-05-22'),
              checkpointState: 'submitted',
              checkpointUpdatedAt: new Date('2026-05-22'),
            },
          ]).then(onfulfilled),
        );
      const result = (await listPendingReviewsHandler({ data: { page: 1, limit: 20 } })) as any;
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should filter by assignmentId when provided', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
      mockDb.then
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ id: 1 }, { id: 2 }]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ count: 1 }]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([
            {
              submissionId: 10,
              checkpointId: 100,
              checkpointName: 'Chapter 1',
              assignmentId: 1,
              assignmentTitle: 'Thesis 2026',
              studentId: 'student-1',
              studentName: 'Alice',
              fileName: 'chapter1.pdf',
              fileSize: 2048,
              fileKey: 'submissions/uuid-1.pdf',
              version: 1,
              uploadedAt: new Date('2026-05-20'),
              checkpointState: 'submitted',
              checkpointUpdatedAt: new Date('2026-05-20'),
            },
          ]).then(onfulfilled),
        );
      const result = (await listPendingReviewsHandler({
        data: { page: 1, limit: 20, assignmentId: 1 },
      })) as any;
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should use LATERAL join from checkpoints instead of correlated subquery (PERF-35)', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
      mockDb.then
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ id: 1 }, { id: 2 }]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ count: 1 }]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([
            {
              submissionId: 10,
              checkpointId: 100,
              checkpointName: 'Chapter 1',
              assignmentId: 1,
              assignmentTitle: 'Thesis 2026',
              studentId: 'student-1',
              studentName: 'Alice',
              fileName: 'chapter1.pdf',
              fileSize: 2048,
              fileKey: 'submissions/uuid-1.pdf',
              version: 1,
              uploadedAt: new Date('2026-05-20'),
              checkpointState: 'submitted',
              checkpointUpdatedAt: new Date('2026-05-20'),
            },
          ]).then(onfulfilled),
        );
      const result = (await listPendingReviewsHandler({ data: { page: 1, limit: 20 } })) as any;
      // PERF-35: Query should start FROM checkpoints (not submissions) with LATERAL join
      expect(mockDb.from).toHaveBeenNthCalledWith(3, checkpoints);
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('submitReviewHandler', () => {
    it('should reject if unauthorized', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);
      const result = await submitReviewHandler({
        data: { submissionId: 1, decision: 'pass', comment: '' },
      });
      expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
    });

    it('should record a pass decision and lock checkpoint read with FOR UPDATE', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
      mockTx.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([
          {
            checkpointId: 100,
            checkpointState: 'under_review',
            assignmentId: 1,
            instructorId: 'instructor-1',
            studentId: 'student-1',
          },
        ]).then(onfulfilled),
      );
      const result = await submitReviewHandler({
        data: { submissionId: 1, decision: 'pass', comment: 'Well done!' },
      });
      expect(result).toEqual({ success: true });
      expect(mockDb.transaction).toHaveBeenCalled();
      expect(mockTx.for).toHaveBeenCalledWith('update', { of: checkpoints });
    });

    it('should reject review when checkpoint is no longer reviewable after lock', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
      mockTx.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([
          {
            checkpointId: 100,
            checkpointState: 'passed',
            assignmentId: 1,
            instructorId: 'instructor-1',
            studentId: 'student-1',
          },
        ]).then(onfulfilled),
      );
      const result = await submitReviewHandler({
        data: { submissionId: 1, decision: 'pass', comment: 'Well done!' },
      });
      expect(result).toEqual({
        error: {
          code: 'BAD_REQUEST',
          message: 'Checkpoint is not in a reviewable state',
        },
      });
      expect(mockTx.insert).not.toHaveBeenCalled();
      expect(mockTx.for).toHaveBeenCalledWith('update', { of: checkpoints });
    });

    it('should record a revise decision with deadline', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
      mockTx.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([
          {
            checkpointId: 100,
            checkpointState: 'under_review',
            assignmentId: 1,
            instructorId: 'instructor-1',
            studentId: 'student-1',
          },
        ]).then(onfulfilled),
      );
      const result = await submitReviewHandler({
        data: {
          submissionId: 1,
          decision: 'revise',
          comment: 'Needs more details',
          revisionDeadline: '2026-06-01T00:00:00Z',
        },
      });
      expect(result).toEqual({ success: true });
      expect(mockDb.transaction).toHaveBeenCalled();
      expect(mockTx.for).toHaveBeenCalledWith('update', { of: checkpoints });
    });

    it('should skip review_completed notification when inApp preference is false', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
      mockTx.then
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([
            {
              checkpointId: 100,
              checkpointState: 'under_review',
              assignmentId: 1,
              instructorId: 'instructor-1',
              studentId: 'student-1',
            },
          ]).then(onfulfilled),
        )
        .mockImplementation((onfulfilled: any) =>
          Promise.resolve([
            {
              settings: {
                notificationPrefs: { review_completed: { inApp: false } },
              },
            },
          ]).then(onfulfilled),
        );

      const result = await submitReviewHandler({
        data: { submissionId: 1, decision: 'pass', comment: 'Well done!' },
      });
      expect(result).toEqual({ success: true });

      // Only the review INSERT, no notification INSERT
      expect(mockTx.insert).toHaveBeenCalledTimes(1);
      const valuesCalls = vi.mocked(mockTx.values).mock.calls.map((c: any[]) => c[0]);
      const notificationValues = valuesCalls.find((v: any) => v?.type === 'review_completed');
      expect(notificationValues).toBeUndefined();
    });

    it('should skip revision_requested notification when inApp preference is false', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
      mockTx.then
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([
            {
              checkpointId: 100,
              checkpointState: 'under_review',
              assignmentId: 1,
              instructorId: 'instructor-1',
              studentId: 'student-1',
            },
          ]).then(onfulfilled),
        )
        .mockImplementation((onfulfilled: any) =>
          Promise.resolve([
            {
              settings: {
                notificationPrefs: { revision_requested: { inApp: false } },
              },
            },
          ]).then(onfulfilled),
        );

      const result = await submitReviewHandler({
        data: {
          submissionId: 1,
          decision: 'revise',
          comment: 'Needs more details',
          revisionDeadline: '2026-06-01T00:00:00Z',
        },
      });
      expect(result).toEqual({ success: true });

      // Only the review INSERT, no notification INSERT
      expect(mockTx.insert).toHaveBeenCalledTimes(1);
      const valuesCalls = vi.mocked(mockTx.values).mock.calls.map((c: any[]) => c[0]);
      const notificationValues = valuesCalls.find((v: any) => v?.type === 'revision_requested');
      expect(notificationValues).toBeUndefined();
    });

    describe('SLA anchoring at submission time', () => {
      const fiveDaysAgo = new Date('2026-06-10T12:00:00Z');

      beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-06-15T12:00:00Z'));
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      it('should apply SLA breach from submission.uploadedAt when reviewing directly from submitted state', async () => {
        vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
        mockTx.then.mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([
            {
              checkpointId: 100,
              checkpointState: 'submitted',
              uploadedAt: fiveDaysAgo,
              checkpointUpdatedAt: new Date('2026-06-15T12:00:00Z'),
              checkpointName: 'Chapter 1',
              checkpointDueDate: new Date('2026-06-01'),
              checkpointOrder: 1,
              assignmentId: 1,
              assignmentTitle: 'Thesis 2026',
              instructorId: 'instructor-1',
              studentId: 'student-1',
              studentName: 'Alice',
              finalDeadline: new Date('2026-08-01'),
            },
          ]).then(onfulfilled),
        );
        const result = await submitReviewHandler({
          data: { submissionId: 1, decision: 'pass', comment: 'Good' },
        });
        expect(result).toEqual({ success: true });
        expect(mockDb.transaction).toHaveBeenCalled();
        expect(vi.mocked(adjustDeadlinesForBreach).mock.calls[0][2]).toBeGreaterThan(0);
        expect(vi.mocked(dispatchSLABreachNotifications).mock.calls[0][2]).toBeGreaterThan(0);
      });

      it('should anchor SLA at submission.uploadedAt even when checkpoint is already under_review', async () => {
        vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
        mockTx.then.mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([
            {
              checkpointId: 100,
              checkpointState: 'under_review',
              uploadedAt: fiveDaysAgo,
              checkpointUpdatedAt: new Date('2026-06-15T12:00:00Z'),
              checkpointName: 'Chapter 1',
              checkpointDueDate: new Date('2026-06-01'),
              checkpointOrder: 1,
              assignmentId: 1,
              assignmentTitle: 'Thesis 2026',
              instructorId: 'instructor-1',
              studentId: 'student-1',
              studentName: 'Alice',
              finalDeadline: new Date('2026-08-01'),
            },
          ]).then(onfulfilled),
        );
        const result = await submitReviewHandler({
          data: { submissionId: 1, decision: 'pass', comment: 'Good' },
        });
        expect(result).toEqual({ success: true });
        expect(vi.mocked(adjustDeadlinesForBreach).mock.calls[0][2]).toBeGreaterThan(0);
        expect(vi.mocked(dispatchSLABreachNotifications).mock.calls[0][2]).toBeGreaterThan(0);
      });
    });

    it('should fail if decision is revise without deadline', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
      mockTx.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([
          {
            checkpointId: 100,
            checkpointState: 'under_review',
            assignmentId: 1,
            instructorId: 'instructor-1',
            studentId: 'student-1',
          },
        ]).then(onfulfilled),
      );
      const result = await submitReviewHandler({
        data: { submissionId: 1, decision: 'revise', comment: '' },
      });
      expect(result).toEqual({
        error: {
          code: 'BAD_REQUEST',
          message: 'Revision deadline is required for revise decision',
        },
      });
    });

    it('should reject if instructor does not own the assignment', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(otherInstructorSession as any);
      const result = await submitReviewHandler({
        data: { submissionId: 1, decision: 'pass', comment: '' },
      });
      expect(result).toEqual({ error: { code: 'NOT_FOUND', message: 'Submission not found' } });
    });
  });
});
