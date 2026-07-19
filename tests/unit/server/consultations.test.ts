/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  logConsultationHandler,
  listConsultationsHandler,
  verifyConsultationHandler,
  rejectConsultationHandler,
  getConsultationDetailHandler,
} from '@/server/consultations.server';
import * as auth from '@/server/auth';
import * as dbMod from '@/db/index';
import { serverError, ErrorCode, isServerError } from '@/lib/errors';

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

describe('Consultation server functions - Logic & Security', () => {
  let returningResult: any = null;

  const mockDb: any = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    for: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    then: vi.fn(function (onfulfilled: any) {
      return Promise.resolve([]).then(onfulfilled);
    }),
  };

  mockDb.transaction = vi.fn().mockImplementation(async (callback: any) => callback(mockDb));

  // Helper to set .returning() to return a thenable with custom data
  function mockReturning(data: any) {
    returningResult = data;
    mockDb.returning.mockReturnValue({
      then: (onfulfilled: any) => Promise.resolve(data).then(onfulfilled),
    });
  }

  const studentSession = {
    user: { id: 'student-1', role: 'student' } as any,
    session: {} as any,
  };

  const instructorSession = {
    user: { id: 'instructor-1', role: 'instructor' } as any,
    session: {} as any,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dbMod.getDb).mockReturnValue(mockDb as any);
  });

  describe('logConsultationHandler', () => {
    const logData = {
      checkpointId: 1,
      sessionType: 'internal' as const,
      notes: 'Discussed methodology',
    };

    it('should fail if unauthorized', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);
      const result = await logConsultationHandler({ data: logData });
      expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
    });

    it('should fail if instructor tries to log consultation', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession);
      const result = await logConsultationHandler({ data: logData });
      expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
    });

    it('should fail if checkpoint not found', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession);
      // No checkpoint found
      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([]).then(onfulfilled),
      );

      const result = await logConsultationHandler({ data: logData });
      expect(result).toEqual({ error: { code: 'NOT_FOUND', message: 'Checkpoint not found' } });
    });

    it('should log consultation successfully for student', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession);

      // Mock checkpoint query returns a result
      mockDb.then
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([
            {
              id: 1,
              assignmentId: 1,
              studentId: 'student-1',
              assignmentInstructorId: 'instructor-1',
            },
          ]).then(onfulfilled),
        )
        // Mock returning for insert
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ id: 1 }]).then(onfulfilled),
        );

      const result = await logConsultationHandler({ data: logData });
      expect(result).toHaveProperty('consultation');
      if (isServerError(result)) throw new Error(result.error.message);
      expect(result.consultation).toEqual({ id: 1 });
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.values).toHaveBeenCalled();
    });
  });

  describe('listConsultationsHandler', () => {
    it('should fail if unauthorized', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);
      const result = await listConsultationsHandler({
        data: { assignmentId: 1, page: 1, limit: 20 },
      });
      expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
    });

    it('should return consultations for student', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession);
      mockDb.then
        // Enrollment check
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ id: 1 }]).then(onfulfilled),
        )
        // Consultation query
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([
            { id: 1, checkpointId: 1, status: 'pending', checkpointName: 'Ch 1' },
          ]).then(onfulfilled),
        )
        // Count query
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ count: 1 }]).then(onfulfilled),
        );
      const result = await listConsultationsHandler({
        data: { assignmentId: 1, page: 1, limit: 20 },
      });
      expect(result).toHaveProperty('consultations');
    });

    it('should return consultations for instructor', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession);
      mockDb.then
        // Assignment ownership check
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ id: 1 }]).then(onfulfilled),
        )
        // Consultation query
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([
            { id: 1, checkpointId: 1, status: 'pending', studentName: 'Student A' },
          ]).then(onfulfilled),
        )
        // Count query
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ count: 1 }]).then(onfulfilled),
        );
      const result = await listConsultationsHandler({
        data: { assignmentId: 1, page: 1, limit: 20 },
      });
      expect(result).toHaveProperty('consultations');
    });

    it('should reject if student is not enrolled', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession);
      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([]).then(onfulfilled),
      );
      const result = await listConsultationsHandler({
        data: { assignmentId: 999, page: 1, limit: 20 },
      });
      expect(result).toEqual(serverError(ErrorCode.NOT_FOUND, 'Assignment not found'));
    });

    it('should reject if instructor does not own assignment', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession);
      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([]).then(onfulfilled),
      );
      const result = await listConsultationsHandler({
        data: { assignmentId: 999, page: 1, limit: 20 },
      });
      expect(result).toEqual(serverError(ErrorCode.NOT_FOUND, 'Assignment not found'));
    });

    it('should accept page/limit params and return total count (PERF-15)', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession);
      mockDb.then
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ id: 1 }]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([
            { id: 1, checkpointId: 1, status: 'pending', checkpointName: 'Ch 1' },
          ]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ count: 42 }]).then(onfulfilled),
        );
      const result = await listConsultationsHandler({
        data: { assignmentId: 1, page: 2, limit: 10 },
      });
      expect(result).toHaveProperty('consultations');
      expect(result).toHaveProperty('total');
      if (!isServerError(result)) {
        expect(result.total).toBe(42);
        expect(mockDb.limit).toHaveBeenCalledWith(10);
        expect(mockDb.offset).toHaveBeenCalledWith(10);
      }
    });

    it('should default to page=1, limit=20 when not provided (PERF-15)', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession);
      mockDb.then
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ id: 1 }]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled))
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ count: 0 }]).then(onfulfilled),
        );
      const result = await listConsultationsHandler({
        data: { assignmentId: 1, page: 1, limit: 20 },
      });
      expect(mockDb.limit).toHaveBeenCalledWith(20);
      expect(mockDb.offset).toHaveBeenCalledWith(0);
    });

    it('should return empty consultations when page is beyond range (PERF-15)', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession);
      mockDb.then
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ id: 1 }]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled))
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ count: 5 }]).then(onfulfilled),
        );
      const result = await listConsultationsHandler({
        data: { assignmentId: 1, page: 100, limit: 20 },
      });
      if (!isServerError(result)) {
        expect(result.consultations).toEqual([]);
        expect(result.total).toBe(5);
      }
    });
  });

  describe('verifyConsultationHandler', () => {
    it('should fail if unauthorized', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);
      const result = await verifyConsultationHandler({ data: { consultationId: 1 } });
      expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
    });

    it('should fail if consultation not found', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession);
      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([]).then(onfulfilled),
      );

      const result = await verifyConsultationHandler({ data: { consultationId: 1 } });
      expect(result).toEqual({ error: { code: 'NOT_FOUND', message: 'Consultation not found' } });
    });

    it('should verify consultation successfully within a transaction with FOR UPDATE lock', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession);

      mockDb.then
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([
            {
              id: 1,
              status: 'pending',
              studentId: 'student-1',
              assignmentId: 1,
              instructorId: 'instructor-1',
            },
          ]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled))
        .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled));

      const result = await verifyConsultationHandler({ data: { consultationId: 1 } });
      expect(result).toEqual({ success: true });

      expect(mockDb.transaction).toHaveBeenCalled();
      expect(mockDb.for).toHaveBeenCalledWith(
        'update',
        expect.objectContaining({ of: expect.anything() }),
      );
    });

    it('should return already-processed error if status changed after lock', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession);

      // Mock consultation SELECT returns non-pending status (stale state after acquiring lock)
      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([
          {
            id: 1,
            status: 'verified',
            studentId: 'student-1',
            assignmentId: 1,
            instructorId: 'instructor-1',
          },
        ]).then(onfulfilled),
      );

      const result = await verifyConsultationHandler({ data: { consultationId: 1 } });
      expect(result).toEqual({
        error: { code: 'BAD_REQUEST', message: 'Consultation has already been processed' },
      });

      // Verify no UPDATE was performed (stale state detected after lock)
      expect(mockDb.update).not.toHaveBeenCalled();
    });
  });

  describe('rejectConsultationHandler', () => {
    it('should fail if unauthorized', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);
      const result = await rejectConsultationHandler({
        data: { consultationId: 1, reason: 'Not acceptable' },
      });
      expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
    });

    it('should reject consultation successfully within a transaction with FOR UPDATE lock', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession);

      mockDb.then
        // Mock consultation SELECT (inside transaction, returns pending record)
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([
            {
              id: 1,
              status: 'pending',
              studentId: 'student-1',
              assignmentId: 1,
              instructorId: 'instructor-1',
            },
          ]).then(onfulfilled),
        )
        // Mock UPDATE result
        .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled))
        // Mock INSERT notification result
        .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled));

      const result = await rejectConsultationHandler({
        data: { consultationId: 1, reason: 'Insufficient detail' },
      });
      expect(result).toEqual({ success: true });

      // Verify transaction was used (SELECT inside db.transaction)
      expect(mockDb.transaction).toHaveBeenCalled();
      // Verify FOR UPDATE row lock was applied
      expect(mockDb.for).toHaveBeenCalledWith(
        'update',
        expect.objectContaining({ of: expect.anything() }),
      );
    });

    it('should return already-processed error if status changed after lock', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession);
      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([
          {
            id: 1,
            status: 'verified',
            studentId: 'student-1',
            assignmentId: 1,
            instructorId: 'instructor-1',
          },
        ]).then(onfulfilled),
      );

      const result = await rejectConsultationHandler({
        data: { consultationId: 1, reason: 'Already done' },
      });
      expect(result).toEqual({
        error: { code: 'BAD_REQUEST', message: 'Consultation has already been processed' },
      });

      // Verify no UPDATE was performed (stale state detected after lock)
      expect(mockDb.update).not.toHaveBeenCalled();
    });
  });

  describe('getConsultationDetailHandler', () => {
    it('should fail if unauthorized', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);
      const result = await getConsultationDetailHandler({ data: { consultationId: 1 } });
      expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
    });

    it('should return consultation detail', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession);

      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([
          {
            id: 1,
            assignmentId: 1,
            checkpointId: 1,
            studentId: 'student-1',
            sessionType: 'internal',
            notes: 'Some notes',
            status: 'pending',
            studentName: 'Student A',
            checkpointName: 'Ch 1',
            instructorId: 'instructor-1',
          },
        ]).then(onfulfilled),
      );

      const result = await getConsultationDetailHandler({ data: { consultationId: 1 } });
      expect(result).toHaveProperty('consultation');
    });

    it('should return error for non-existent consultation', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession);
      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([]).then(onfulfilled),
      );

      const result = await getConsultationDetailHandler({ data: { consultationId: 999 } });
      expect(result).toEqual({ error: { code: 'NOT_FOUND', message: 'Consultation not found' } });
    });
  });
});
