/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import {
  SubmitCheckpointSchema,
  ListSubmissionsSchema,
  GetSubmissionDetailSchema,
} from '@/server/submissions';
import {
  submitCheckpointHandler,
  listSubmissionsHandler,
  getSubmissionDetailHandler,
} from '@/server/submissions.server';
import * as auth from '@/server/auth';
import * as dbMod from '@/db/index';
import * as storage from '@/lib/storage';

vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn(),
}));

vi.mock('@/db/index', () => ({
  getDb: vi.fn(),
}));

vi.mock('@tanstack/react-start', () => ({
  createServerFn: vi.fn().mockReturnValue({
    handler: vi.fn().mockImplementation((fn) => fn),
  }),
}));

vi.mock('@/lib/storage', () => ({
  generateFileKey: vi.fn().mockReturnValue('submissions/test-uuid.pdf'),
  generatePresignedUploadUrl: vi.fn().mockResolvedValue('https://presigned-upload.test/url'),
  generatePresignedDownloadUrl: vi.fn().mockResolvedValue('https://presigned-download.test/url'),
  getR2Client: vi.fn().mockReturnValue({}),
}));

describe('Submission server functions - Schemas', () => {
  describe('SubmitCheckpointSchema', () => {
    it('should accept valid input', () => {
      const result = SubmitCheckpointSchema.safeParse({
        checkpointId: 1,
        fileKey: 'submissions/uuid-123.pdf',
        fileName: 'chapter1.pdf',
        fileSize: 1024,
      });
      expect(result.success).toBe(true);
    });

    it('should reject missing checkpointId', () => {
      const result = SubmitCheckpointSchema.safeParse({
        fileKey: 'submissions/uuid-123.pdf',
        fileName: 'chapter1.pdf',
        fileSize: 1024,
      });
      expect(result.success).toBe(false);
    });

    it('should reject negative fileSize', () => {
      const result = SubmitCheckpointSchema.safeParse({
        checkpointId: 1,
        fileKey: 'submissions/uuid-123.pdf',
        fileName: 'chapter1.pdf',
        fileSize: -1,
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty fileName', () => {
      const result = SubmitCheckpointSchema.safeParse({
        checkpointId: 1,
        fileKey: 'submissions/uuid-123.pdf',
        fileName: '',
        fileSize: 1024,
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty fileKey', () => {
      const result = SubmitCheckpointSchema.safeParse({
        checkpointId: 1,
        fileKey: '',
        fileName: 'chapter1.pdf',
        fileSize: 1024,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('ListSubmissionsSchema', () => {
    it('should accept valid checkpointId', () => {
      const result = ListSubmissionsSchema.safeParse({ checkpointId: 1 });
      expect(result.success).toBe(true);
    });

    it('should reject non-numeric checkpointId', () => {
      const result = ListSubmissionsSchema.safeParse({ checkpointId: 'abc' });
      expect(result.success).toBe(false);
    });
  });

  describe('GetSubmissionDetailSchema', () => {
    it('should accept valid submissionId', () => {
      const result = GetSubmissionDetailSchema.safeParse({ submissionId: 1 });
      expect(result.success).toBe(true);
    });

    it('should reject non-numeric submissionId', () => {
      const result = GetSubmissionDetailSchema.safeParse({ submissionId: 'abc' });
      expect(result.success).toBe(false);
    });
  });
});

describe('Submission server functions - Logic & Security', () => {
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

  describe('submitCheckpointHandler', () => {
    const submitData = {
      checkpointId: 1,
      fileKey: 'submissions/uuid-123.pdf',
      fileName: 'chapter1.pdf',
      fileSize: 1024,
    };

    it('should reject if unauthorized', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);

      const result = await submitCheckpointHandler({ data: submitData });
      expect(result).toEqual({ error: 'Unauthorized' });
    });

    it('should reject if not a student', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
        user: { id: 'instructor-1', role: 'instructor' } as any,
        session: {} as any,
      });

      const result = await submitCheckpointHandler({ data: submitData });
      expect(result).toEqual({ error: 'Unauthorized' });
    });

    it('should reject upload to locked checkpoint', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);

      // Ownership check: assignment_students join returns the checkpoint
      mockDb.then
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([
            {
              id: 1,
              assignmentId: 101,
              studentId: 'student-1',
              state: 'locked',
            },
          ]).then(onfulfilled),
        )
        .mockImplementationOnce(
          (onfulfilled: any) => Promise.resolve([]).then(onfulfilled), // No previous submissions
        );

      const result = await submitCheckpointHandler({ data: submitData });
      expect(result).toEqual({ error: 'Checkpoint is locked' });
    });

    it('should transition unlocked → submitted on first upload', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);

      mockDb.then
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([
            {
              id: 1,
              assignmentId: 101,
              studentId: 'student-1',
              state: 'unlocked',
            },
          ]).then(onfulfilled),
        )
        .mockImplementationOnce(
          (onfulfilled: any) => Promise.resolve([]).then(onfulfilled), // No previous submissions → version 1
        );

      const result = await submitCheckpointHandler({ data: submitData });
      expect(result).toEqual({ success: true });
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should reject upload to already-submitted checkpoint (no revise)', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);

      mockDb.then
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([
            {
              id: 1,
              assignmentId: 101,
              studentId: 'student-1',
              state: 'submitted',
            },
          ]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled));

      const result = await submitCheckpointHandler({ data: submitData });
      expect(result).toEqual({ error: 'Checkpoint is not in a submittable state' });
    });

    it('should accept upload from revise state and transition to submitted', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);

      mockDb.then
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([
            {
              id: 1,
              assignmentId: 101,
              studentId: 'student-1',
              state: 'revise',
            },
          ]).then(onfulfilled),
        )
        .mockImplementationOnce(
          (onfulfilled: any) => Promise.resolve([]).then(onfulfilled), // No previous submissions
        );

      const result = await submitCheckpointHandler({ data: submitData });
      expect(result).toEqual({ success: true });
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should reject upload if checkpoint does not belong to the student', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(otherStudentSession as any);

      mockDb.then.mockImplementationOnce(
        (onfulfilled: any) => Promise.resolve([]).then(onfulfilled), // No checkpoint found for this student
      );

      const result = await submitCheckpointHandler({ data: submitData });
      expect(result).toEqual({ error: 'Checkpoint not found' });
    });

    it('should reject upload under_review state', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);

      mockDb.then
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([
            {
              id: 1,
              assignmentId: 101,
              studentId: 'student-1',
              state: 'under_review',
            },
          ]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled));

      const result = await submitCheckpointHandler({ data: submitData });
      expect(result).toEqual({ error: 'Checkpoint is not in a submittable state' });
    });

    it('should reject upload passed state', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);

      mockDb.then
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([
            {
              id: 1,
              assignmentId: 101,
              studentId: 'student-1',
              state: 'passed',
            },
          ]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled));

      const result = await submitCheckpointHandler({ data: submitData });
      expect(result).toEqual({ error: 'Checkpoint is not in a submittable state' });
    });
  });

  describe('listSubmissionsHandler', () => {
    it('should reject if unauthorized', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);

      const result = await listSubmissionsHandler({ data: { checkpointId: 1 } });
      expect(result).toEqual({ error: 'Unauthorized' });
    });

    it('should return empty array when no submissions exist', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);

      mockDb.then
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ id: 1, studentId: 'student-1' }]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled));

      const result = await listSubmissionsHandler({ data: { checkpointId: 1 } });
      expect(result).toEqual({ submissions: [] });
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
        );

      const result = await listSubmissionsHandler({ data: { checkpointId: 1 } });
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

      const result = await listSubmissionsHandler({ data: { checkpointId: 1 } });
      expect(result).toEqual({ error: 'Checkpoint not found' });
    });
  });

  describe('getSubmissionDetailHandler', () => {
    it('should reject if unauthorized', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);

      const result = await getSubmissionDetailHandler({ data: { submissionId: 1 } });
      expect(result).toEqual({ error: 'Unauthorized' });
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

      const result = await getSubmissionDetailHandler({ data: { submissionId: 1 } });
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
      expect(result).toEqual({ error: 'Submission not found' });
    });

    it('should reject access to another student submission', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(otherStudentSession as any);

      // The real WHERE clause filters by uploadedBy = 'student-2', so the mock
      // returns empty (simulating the filter correctly)
      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([]).then(onfulfilled),
      );

      const result = await getSubmissionDetailHandler({ data: { submissionId: 1 } });
      expect(result).toEqual({ error: 'Submission not found' });
    });
  });

  describe('getPresignedUploadUrl', () => {
    it('should generate UUID file key and return URL for unlocked checkpoint', async () => {
      // This will be tested via the handler import
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

      const result = await listSubmissionsHandler({ data: { checkpointId: 1 } });
      expect(result).toEqual({ error: 'Checkpoint not found' });
    });

    it('should prevent student A from submitting to student B checkpoint', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
        user: { id: 'student-2', role: 'student' } as any,
        session: {} as any,
      });

      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([]).then(onfulfilled),
      );

      const result = await submitCheckpointHandler({
        data: {
          checkpointId: 1,
          fileKey: 'submissions/uuid-123.pdf',
          fileName: 'test.pdf',
          fileSize: 1024,
        },
      });
      expect(result).toEqual({ error: 'Checkpoint not found' });
    });
  });
});
