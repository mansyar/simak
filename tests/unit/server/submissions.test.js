/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  SubmitCheckpointSchema,
  ListSubmissionsSchema,
  GetSubmissionDetailSchema,
} from '@/server/submissions';
import { submitCheckpointHandler, listSubmissionsHandler } from '@/server/submissions.server';
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
  let mockDb;
  const studentSession = {
    user: { id: 'student-1', role: 'student' },
    session: {},
  };
  const otherStudentSession = {
    user: { id: 'student-2', role: 'student' },
    session: {},
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
      then: vi.fn(function (onfulfilled) {
        return Promise.resolve([]).then(onfulfilled);
      }),
    };
    vi.mocked(dbMod.getDb).mockReturnValue(mockDb);
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
        user: { id: 'instructor-1', role: 'instructor' },
        session: {},
      });
      const result = await submitCheckpointHandler({ data: submitData });
      expect(result).toEqual({ error: 'Unauthorized' });
    });
    it('should reject upload to locked checkpoint', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession);
      // Ownership check: assignment_students join returns the checkpoint
      mockDb.then
        .mockImplementationOnce((onfulfilled) =>
          Promise.resolve([
            {
              id: 1,
              assignmentId: 101,
              studentId: 'student-1',
              state: 'locked',
            },
          ]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled) => Promise.resolve([]).then(onfulfilled));
      const result = await submitCheckpointHandler({ data: submitData });
      expect(result).toEqual({ error: 'Checkpoint is locked' });
    });
    it('should transition unlocked → submitted on first upload', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession);
      mockDb.then
        .mockImplementationOnce((onfulfilled) =>
          Promise.resolve([
            {
              id: 1,
              assignmentId: 101,
              studentId: 'student-1',
              state: 'unlocked',
            },
          ]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled) => Promise.resolve([]).then(onfulfilled));
      const result = await submitCheckpointHandler({ data: submitData });
      expect(result).toEqual({ success: true });
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.update).toHaveBeenCalled();
    });
    it('should reject upload to already-submitted checkpoint (no revise)', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession);
      mockDb.then
        .mockImplementationOnce((onfulfilled) =>
          Promise.resolve([
            {
              id: 1,
              assignmentId: 101,
              studentId: 'student-1',
              state: 'submitted',
            },
          ]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled) => Promise.resolve([]).then(onfulfilled));
      const result = await submitCheckpointHandler({ data: submitData });
      expect(result).toEqual({ error: 'Checkpoint is not in a submittable state' });
    });
    it('should reject file exceeding 25MB limit', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession);
      mockDb.then.mockImplementationOnce((onfulfilled) =>
        Promise.resolve([
          {
            id: 1,
            assignmentId: 101,
            studentId: 'student-1',
            state: 'unlocked',
          },
        ]).then(onfulfilled),
      );
      const result = await submitCheckpointHandler({
        data: {
          checkpointId: 1,
          fileKey: 'submissions/uuid-123.pdf',
          fileName: 'big.pdf',
          fileSize: 25 * 1024 * 1024 + 1,
        },
      });
      expect(result).toEqual({ error: 'File size exceeds 25MB limit' });
    });
    it('should reject file with unsupported extension', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession);
      mockDb.then.mockImplementationOnce((onfulfilled) =>
        Promise.resolve([
          {
            id: 1,
            assignmentId: 101,
            studentId: 'student-1',
            state: 'unlocked',
          },
        ]).then(onfulfilled),
      );
      const result = await submitCheckpointHandler({
        data: {
          checkpointId: 1,
          fileKey: 'submissions/uuid-123.exe',
          fileName: 'malicious.exe',
          fileSize: 1024,
        },
      });
      expect(result).toEqual({ error: 'Unsupported file type' });
    });
    it('should accept upload from revise state and transition to submitted', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession);
      mockDb.then
        .mockImplementationOnce((onfulfilled) =>
          Promise.resolve([
            {
              id: 1,
              assignmentId: 101,
              studentId: 'student-1',
              state: 'revise',
            },
          ]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled) => Promise.resolve([]).then(onfulfilled));
      const result = await submitCheckpointHandler({ data: submitData });
      expect(result).toEqual({ success: true });
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.update).toHaveBeenCalled();
    });
    it('should reject upload if checkpoint does not belong to the student', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(otherStudentSession);
      mockDb.then.mockImplementationOnce((onfulfilled) => Promise.resolve([]).then(onfulfilled));
      const result = await submitCheckpointHandler({ data: submitData });
      expect(result).toEqual({ error: 'Checkpoint not found' });
    });
    it('should reject upload under_review state', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession);
      mockDb.then
        .mockImplementationOnce((onfulfilled) =>
          Promise.resolve([
            {
              id: 1,
              assignmentId: 101,
              studentId: 'student-1',
              state: 'under_review',
            },
          ]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled) => Promise.resolve([]).then(onfulfilled));
      const result = await submitCheckpointHandler({ data: submitData });
      expect(result).toEqual({ error: 'Checkpoint is not in a submittable state' });
    });
    it('should reject upload passed state', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession);
      mockDb.then
        .mockImplementationOnce((onfulfilled) =>
          Promise.resolve([
            {
              id: 1,
              assignmentId: 101,
              studentId: 'student-1',
              state: 'passed',
            },
          ]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled) => Promise.resolve([]).then(onfulfilled));
      const result = await submitCheckpointHandler({ data: submitData });
      expect(result).toEqual({ error: 'Checkpoint is not in a submittable state' });
    });
    it('should block submission when insufficient verified consultations', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession);
      mockDb.then
        .mockImplementationOnce((onfulfilled) =>
          Promise.resolve([
            {
              id: 1,
              assignmentId: 101,
              studentId: 'student-1',
              state: 'unlocked',
              minConsultations: 2,
            },
          ]).then(onfulfilled),
        )
        // Consultation count query returns only 1 verified
        .mockImplementationOnce((onfulfilled) => Promise.resolve([{ count: 1 }]).then(onfulfilled));
      const result = await submitCheckpointHandler({ data: submitData });
      expect(result).toHaveProperty('error');
      expect(result.error).toContain('requires 2 verified consultations');
    });
    it('should allow submission when sufficient verified consultations', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession);
      mockDb.then
        .mockImplementationOnce((onfulfilled) =>
          Promise.resolve([
            {
              id: 1,
              assignmentId: 101,
              studentId: 'student-1',
              state: 'unlocked',
              minConsultations: 2,
            },
          ]).then(onfulfilled),
        )
        // Consultation count query returns 3 verified (>= 2)
        .mockImplementationOnce((onfulfilled) => Promise.resolve([{ count: 3 }]).then(onfulfilled))
        // Version query
        .mockImplementationOnce((onfulfilled) => Promise.resolve([]).then(onfulfilled));
      const result = await submitCheckpointHandler({ data: submitData });
      expect(result).toEqual({ success: true });
    });
    it('should notify instructor on successful submission', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession);
      mockDb.then
        .mockImplementationOnce((onfulfilled) =>
          Promise.resolve([
            { id: 1, assignmentId: 101, studentId: 'student-1', state: 'unlocked' },
          ]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled) => Promise.resolve([]).then(onfulfilled))
        .mockImplementationOnce((onfulfilled) => Promise.resolve([]).then(onfulfilled))
        .mockImplementationOnce((onfulfilled) => Promise.resolve([]).then(onfulfilled))
        .mockImplementationOnce((onfulfilled) =>
          Promise.resolve([{ instructorId: 'instructor-1', assignmentTitle: 'Thesis 2026' }]).then(
            onfulfilled,
          ),
        );
      const result = await submitCheckpointHandler({ data: submitData });
      expect(result).toEqual({ success: true });
      expect(mockDb.insert).toHaveBeenCalled();
      // The notification insert adds a second db.insert call (notification)
      expect(mockDb.values).toHaveBeenCalledTimes(2);
      const valuesCalls = vi.mocked(mockDb.values).mock.calls;
      const notificationValues = valuesCalls[1][0];
      expect(notificationValues.userId).toBe('instructor-1');
      expect(notificationValues.type).toBe('submission_received');
    });
  });
  describe('Ownership guard', () => {
    it('should prevent student A from listing student B submissions', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
        user: { id: 'student-2', role: 'student' },
        session: {},
      });
      mockDb.then.mockImplementationOnce((onfulfilled) => Promise.resolve([]).then(onfulfilled));
      const result = await listSubmissionsHandler({ data: { checkpointId: 1 } });
      expect(result).toEqual({ error: 'Checkpoint not found' });
    });
    it('should prevent student A from submitting to student B checkpoint', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
        user: { id: 'student-2', role: 'student' },
        session: {},
      });
      mockDb.then.mockImplementationOnce((onfulfilled) => Promise.resolve([]).then(onfulfilled));
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
