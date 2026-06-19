/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getLatestReviewHandler, getReviewDetailHandler } from '@/server/reviews.server';
import * as auth from '@/server/auth';
import * as dbMod from '@/db/index';
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
  let mockDb;
  const instructorSession = {
    user: { id: 'instructor-1', role: 'instructor' },
    session: {},
  };
  const studentSession = {
    user: { id: 'student-1', role: 'student' },
    session: {},
  };
  const otherInstructorSession = {
    user: { id: 'instructor-2', role: 'instructor' },
    session: {},
  };
  beforeEach(() => {
    vi.clearAllMocks();
    const mockTx = {
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
      then: vi.fn((onfulfilled) => Promise.resolve([]).then(onfulfilled)),
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
      transaction: vi.fn((cb) => cb(mockTx)),
      then: vi.fn((onfulfilled) => Promise.resolve([]).then(onfulfilled)),
    };
    vi.mocked(dbMod.getDb).mockReturnValue(mockDb);
  });
  describe('getLatestReviewHandler', () => {
    it('should return the most recent review for a student checkpoint', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession);
      // First query: ownership check (returns a checkpoint row)
      mockDb.then
        .mockImplementationOnce((onfulfilled) => Promise.resolve([{ id: 100 }]).then(onfulfilled))
        // Second query: review fetch
        .mockImplementationOnce((onfulfilled) =>
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
      const result = await getLatestReviewHandler({ data: { checkpointId: 100 } });
      expect(result.review).toBeDefined();
      expect(result.review.decision).toBe('revise');
    });
    it('should return the most recent review for an instructor-owned checkpoint', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession);
      // First query: ownership check (returns a checkpoint row)
      mockDb.then
        .mockImplementationOnce((onfulfilled) => Promise.resolve([{ id: 100 }]).then(onfulfilled))
        // Second query: review fetch
        .mockImplementationOnce((onfulfilled) =>
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
      const result = await getLatestReviewHandler({ data: { checkpointId: 100 } });
      expect(result.review).toBeDefined();
      expect(result.review.decision).toBe('pass');
    });
    it('should return null if no review exists', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession);
      // First query: ownership check (returns a checkpoint row)
      mockDb.then
        .mockImplementationOnce((onfulfilled) => Promise.resolve([{ id: 999 }]).then(onfulfilled))
        // Second query: no review found
        .mockImplementationOnce((onfulfilled) => Promise.resolve([]).then(onfulfilled));
      const result = await getLatestReviewHandler({ data: { checkpointId: 999 } });
      expect(result.review).toBeNull();
    });
    it('should reject if student does not own the checkpoint', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession);
      // Ownership check returns empty (checkpoint not assigned to this student)
      mockDb.then.mockImplementationOnce((onfulfilled) => Promise.resolve([]).then(onfulfilled));
      const result = await getLatestReviewHandler({ data: { checkpointId: 100 } });
      expect(result).toEqual({ error: 'Checkpoint not found' });
    });
    it('should reject if instructor does not own the checkpoint', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(otherInstructorSession);
      // Ownership check returns empty (checkpoint belongs to another instructor)
      mockDb.then.mockImplementationOnce((onfulfilled) => Promise.resolve([]).then(onfulfilled));
      const result = await getLatestReviewHandler({ data: { checkpointId: 100 } });
      expect(result).toEqual({ error: 'Checkpoint not found' });
    });
    it('should reject if unauthorized', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);
      const result = await getLatestReviewHandler({ data: { checkpointId: 1 } });
      expect(result).toEqual({ error: 'Unauthorized' });
    });
  });
  describe('getReviewDetailHandler', () => {
    it('should reject if unauthorized', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);
      const result = await getReviewDetailHandler({ data: { submissionId: 1 } });
      expect(result).toEqual({ error: 'Unauthorized' });
    });
    it('should return submission detail with download URL and review history', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession);
      mockDb.then
        .mockImplementationOnce((onfulfilled) =>
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
        .mockImplementationOnce((onfulfilled) =>
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
      const result = await getReviewDetailHandler({ data: { submissionId: 1 } });
      expect(result).toHaveProperty('submission');
      expect(result).toHaveProperty('reviewHistory');
      expect(result.reviewHistory).toHaveLength(1);
    });
    it('should return error for non-existent submission', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession);
      mockDb.then.mockImplementationOnce((onfulfilled) => Promise.resolve([]).then(onfulfilled));
      const result = await getReviewDetailHandler({ data: { submissionId: 999 } });
      expect(result).toEqual({ error: 'Submission not found' });
    });
  });
});
