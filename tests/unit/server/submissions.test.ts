/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { submitCheckpointHandler } from '@/server/submissions.server';
import { isServerError } from '@/lib/errors';
import * as auth from '@/server/auth';
import * as dbMod from '@/db/index';
import { logAuditEvent } from '@/lib/audit';

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
  getObjectContentLength: vi.fn().mockResolvedValue(1024),
}));

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

    it('should reject if unauthorized', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);

      const result = await submitCheckpointHandler({ data: submitData });
      expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
    });

    it('should reject if not a student', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
        user: { id: 'instructor-1', role: 'instructor' } as any,
        session: {} as any,
      });

      const result = await submitCheckpointHandler({ data: submitData });
      expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
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
      expect(result).toEqual({ error: { code: 'BAD_REQUEST', message: 'Checkpoint is locked' } });
    });

    it('should transition unlocked → submitted on first upload', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);

      mockDb.returning.mockReturnValueOnce({
        then: (onfulfilled: any) => Promise.resolve([{ id: 1 }]).then(onfulfilled),
      });

      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([
          {
            id: 1,
            assignmentId: 101,
            studentId: 'student-1',
            state: 'unlocked',
          },
        ]).then(onfulfilled),
      );

      enqueueIntentSuccess(mockDb);
      mockDb.then.mockImplementationOnce(
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
      expect(result).toEqual({
        error: { code: 'BAD_REQUEST', message: 'Checkpoint is not in a submittable state' },
      });

      // FR2: the stale-state re-read must happen under FOR UPDATE.
      expect(mockDb.for).toHaveBeenCalledWith('update');
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('should reject file exceeding 25MB limit', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);

      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([
          {
            id: 1,
            assignmentId: 101,
            studentId: 'student-1',
            state: 'unlocked',
          },
        ]).then(onfulfilled),
      );

      enqueueIntentSuccess(mockDb);

      const { getObjectContentLength } = await import('@/lib/storage');
      vi.mocked(getObjectContentLength).mockResolvedValueOnce(25 * 1024 * 1024 + 1);

      const result = await submitCheckpointHandler({
        data: {
          checkpointId: 1,
          fileKey: 'submissions/uuid-123.pdf',
          fileName: 'big.pdf',
          fileSize: 25 * 1024 * 1024 + 1,
        },
      });
      expect(result).toEqual({
        error: { code: 'BAD_REQUEST', message: 'File size exceeds 25MB limit' },
      });
    });

    it('should reject file with unsupported extension', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);

      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
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
      expect(result).toEqual({ error: { code: 'BAD_REQUEST', message: 'Unsupported file type' } });
    });

    it('should accept upload from revise state and transition to submitted', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);

      mockDb.returning.mockReturnValueOnce({
        then: (onfulfilled: any) => Promise.resolve([{ id: 2 }]).then(onfulfilled),
      });

      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([
          {
            id: 1,
            assignmentId: 101,
            studentId: 'student-1',
            state: 'revise',
          },
        ]).then(onfulfilled),
      );

      enqueueIntentSuccess(mockDb);
      mockDb.then.mockImplementationOnce(
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
      expect(result).toEqual({ error: { code: 'NOT_FOUND', message: 'Checkpoint not found' } });
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
      expect(result).toEqual({
        error: { code: 'BAD_REQUEST', message: 'Checkpoint is not in a submittable state' },
      });
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
      expect(result).toEqual({
        error: { code: 'BAD_REQUEST', message: 'Checkpoint is not in a submittable state' },
      });
    });

    it('should block submission when insufficient verified consultations', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);

      mockDb.then
        .mockImplementationOnce((onfulfilled: any) =>
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
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ count: 1 }]).then(onfulfilled),
        );

      const result = await submitCheckpointHandler({ data: submitData });
      expect(result).toHaveProperty('error');
      if (!isServerError(result)) throw new Error('Expected server error');
      expect(result.error.message).toContain('requires 2 verified consultations');
    });

    it('should allow submission when sufficient verified consultations', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);

      mockDb.returning.mockReturnValueOnce({
        then: (onfulfilled: any) => Promise.resolve([{ id: 3 }]).then(onfulfilled),
      });

      mockDb.then
        .mockImplementationOnce((onfulfilled: any) =>
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
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ count: 3 }]).then(onfulfilled),
        );

      enqueueIntentSuccess(mockDb);
      mockDb.then
        // Version query
        .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled));

      const result = await submitCheckpointHandler({ data: submitData });
      expect(result).toEqual({ success: true });
    });

    it('should notify instructor on successful submission', async () => {
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
        );

      const result = await submitCheckpointHandler({ data: submitData });
      expect(result).toEqual({ success: true });
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.values.mock.calls.length).toBeGreaterThanOrEqual(2);
      const valuesCalls = vi.mocked(mockDb.values).mock.calls.map((c: any[]) => c[0]);
      const notificationValues = valuesCalls.find((v: any) => v?.type === 'submission_received');
      expect(notificationValues).toBeDefined();
      expect(notificationValues.userId).toBe('instructor-1');
      expect(notificationValues.type).toBe('submission_received');
      expect(notificationValues.metadata.submissionId).toBe(123);
    });

    it('should return success when post-commit audit logging throws', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);
      vi.mocked(logAuditEvent).mockRejectedValueOnce(new Error('audit service down'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      mockDb.returning.mockReturnValueOnce({
        then: (onfulfilled: any) => Promise.resolve([{ id: 42 }]).then(onfulfilled),
      });

      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([
          { id: 1, assignmentId: 101, studentId: 'student-1', state: 'unlocked' },
        ]).then(onfulfilled),
      );

      enqueueIntentSuccess(mockDb);
      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([]).then(onfulfilled),
      );

      const result = await submitCheckpointHandler({ data: submitData });

      expect(result).toEqual({ success: true });
      expect(logAuditEvent).toHaveBeenCalledWith({
        actorId: 'student-1',
        action: 'submission.created',
        entityType: 'submission',
        entityId: '42',
        details: { checkpointId: 1, fileName: 'chapter1.pdf' },
      });
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to log submission.created audit event:',
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Ownership guard', () => {
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
      expect(result).toEqual({ error: { code: 'NOT_FOUND', message: 'Checkpoint not found' } });
    });
  });
});
