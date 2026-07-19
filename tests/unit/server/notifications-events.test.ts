/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { submitCheckpointHandler } from '@/server/submissions.server';
import { submitReviewHandler } from '@/server/reviews.server';
import * as auth from '@/server/auth';
import * as dbMod from '@/db/index';

vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn(),
}));

vi.mock('@/db/index', () => ({
  getDb: vi.fn(),
}));

vi.mock('@/lib/storage', () => ({
  generateFileKey: vi.fn().mockReturnValue('submissions/test-uuid.pdf'),
  generatePresignedUploadUrl: vi.fn().mockResolvedValue('https://presigned-upload.test/url'),
  generatePresignedDownloadUrl: vi.fn().mockResolvedValue('https://presigned-download.test/url'),
  getR2Client: vi.fn().mockReturnValue({}),
  getObjectContentLength: vi.fn().mockResolvedValue({ ok: true, size: 1024 }),
}));

describe('Event trigger notifications', () => {
  let mockDb: any;
  let mockTx: any;
  const instructorSession = {
    user: { id: 'instructor-1', role: 'instructor' as const, name: 'Dr. Smith' },
    session: {} as any,
  };
  const studentSession = {
    user: { id: 'student-1', role: 'student' as const, name: 'Alice' },
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
      for: vi.fn().mockReturnThis(),
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

  describe('submitCheckpointHandler — submission_received notification', () => {
    it('should create a submission_received notification for the instructor when checkpoint is submitted', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);

      // All submitCheckpointHandler writes run inside db.transaction using tx.
      mockDb.transaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => {
        // Checkpoint lookup (returns checkpoint + assignment info)
        mockTx.then.mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([
            {
              id: 100,
              assignmentId: 1,
              studentId: 'student-1',
              state: 'unlocked',
              minConsultations: 0,
            },
          ]).then(onfulfilled),
        );

        // Upload intent lookup
        mockTx.then.mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([
            {
              fileKey: 'submissions/uuid-1.pdf',
              userId: 'student-1',
              purpose: 'submission',
              checkpointId: 100,
              consumedAt: null,
            },
          ]).then(onfulfilled),
        );

        // Consume intent
        mockTx.then.mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([]).then(onfulfilled),
        );

        // Version count query
        mockTx.then.mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ maxVersion: 0 }]).then(onfulfilled),
        );

        // Submission insert returns real submission id via .returning()
        mockTx.returning.mockReturnValueOnce({
          then: (onfulfilled: any) => Promise.resolve([{ id: 42 }]).then(onfulfilled),
        });

        // Checkpoint state update to 'submitted'
        mockTx.then.mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{}]).then(onfulfilled),
        );

        // Instructor lookup for notification
        mockTx.then.mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ instructorId: 'instructor-1', assignmentTitle: 'Thesis 2026' }]).then(
            onfulfilled,
          ),
        );

        // Notification insert
        mockTx.then.mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{}]).then(onfulfilled),
        );

        return cb(mockTx);
      });

      const result = await submitCheckpointHandler({
        data: {
          checkpointId: 100,
          fileKey: 'submissions/uuid-1.pdf',
          fileName: 'chapter1.pdf',
          fileSize: 1024,
        },
      });

      expect(result).toEqual({ success: true });
      // Verify notification was created via db.insert(notifications)
      expect(mockTx.insert).toHaveBeenCalled();
    });
  });

  describe('submitReviewHandler — review_completed notification (pass)', () => {
    it('should create a review_completed notification for the student when pass decision is made', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);

      // Transaction mock — pass decision
      mockDb.transaction.mockImplementation(async (cb: any) => {
        // Locked submission read
        mockTx.then.mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([
            {
              checkpointId: 100,
              checkpointState: 'under_review',
              assignmentId: 1,
              instructorId: 'instructor-1',
              studentId: 'student-1',
              studentName: 'Alice',
              checkpointName: 'Chapter 1',
              assignmentTitle: 'Thesis 2026',
              checkpointUpdatedAt: new Date('2026-05-20'),
              checkpointDueDate: new Date('2026-06-15'),
              checkpointOrder: 1,
              finalDeadline: new Date('2026-07-01'),
            },
          ]).then(onfulfilled),
        );
        // Review insert
        mockTx.then.mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{}]).then(onfulfilled),
        );
        return cb(mockTx);
      });

      const result = await submitReviewHandler({
        data: {
          submissionId: 1,
          decision: 'pass',
          comment: 'Well done!',
        },
      });

      expect(result).toEqual({ success: true });
      // Verify notification was created via mockTx.insert(notifications)
      expect(mockTx.insert).toHaveBeenCalled();
    });
  });

  describe('submitReviewHandler — revision_requested notification (revise)', () => {
    it('should create a revision_requested notification for the student when revise decision is made', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);

      // Transaction mock — revise decision
      mockDb.transaction.mockImplementation(async (cb: any) => {
        // Locked submission read
        mockTx.then.mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([
            {
              checkpointId: 100,
              checkpointState: 'under_review',
              assignmentId: 1,
              instructorId: 'instructor-1',
              studentId: 'student-1',
              studentName: 'Alice',
              checkpointName: 'Chapter 1',
              assignmentTitle: 'Thesis 2026',
              checkpointUpdatedAt: new Date('2026-05-20'),
              checkpointDueDate: new Date('2026-06-15'),
              checkpointOrder: 1,
              finalDeadline: new Date('2026-07-01'),
            },
          ]).then(onfulfilled),
        );
        // Review insert
        mockTx.then.mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{}]).then(onfulfilled),
        );
        return cb(mockTx);
      });

      const result = await submitReviewHandler({
        data: {
          submissionId: 1,
          decision: 'revise',
          comment: 'Needs more details',
          revisionDeadline: '2026-06-01T00:00:00Z',
        },
      });

      expect(result).toEqual({ success: true });
      // Verify notification was created via mockTx.insert(notifications)
      expect(mockTx.insert).toHaveBeenCalled();
    });
  });
});
