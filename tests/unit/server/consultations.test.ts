/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  logConsultationHandler,
  listConsultationsHandler,
  listPendingConsultationsHandler,
  verifyConsultationHandler,
  rejectConsultationHandler,
  getConsultationDetailHandler,
  listVerifiedCountsHandler,
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
      const result = await listConsultationsHandler({ data: { assignmentId: 1 } });
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
        );
      const result = await listConsultationsHandler({ data: { assignmentId: 1 } });
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
        );
      const result = await listConsultationsHandler({ data: { assignmentId: 1 } });
      expect(result).toHaveProperty('consultations');
    });

    it('should reject if student is not enrolled', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession);
      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([]).then(onfulfilled),
      );
      const result = await listConsultationsHandler({ data: { assignmentId: 999 } });
      expect(result).toEqual(serverError(ErrorCode.NOT_FOUND, 'Assignment not found'));
    });

    it('should reject if instructor does not own assignment', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession);
      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([]).then(onfulfilled),
      );
      const result = await listConsultationsHandler({ data: { assignmentId: 999 } });
      expect(result).toEqual(serverError(ErrorCode.NOT_FOUND, 'Assignment not found'));
    });
  });

  describe('listPendingConsultationsHandler', () => {
    it('should fail if unauthorized', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);
      const result = await listPendingConsultationsHandler({ data: { assignmentId: 1 } });
      expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
    });

    it('should fail if student tries', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession);
      const result = await listPendingConsultationsHandler({ data: { assignmentId: 1 } });
      expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
    });

    it('should return pending consultations for instructor', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession);

      // Mock assignment ownership check
      mockDb.then
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ id: 1 }]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([
            {
              id: 1,
              studentName: 'Student A',
              checkpointName: 'Ch 1',
              sessionType: 'internal',
              createdAt: new Date('2026-05-01T00:00:00.000Z'),
            },
          ]).then(onfulfilled),
        );

      const result = await listPendingConsultationsHandler({ data: { assignmentId: 1 } });
      expect(result).toHaveProperty('consultations');
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

    it('should verify consultation successfully', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession);

      // Mock consultation query returns pending record
      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([
          {
            id: 1,
            status: 'pending',
            studentId: 'student-1',
            assignmentId: 1,
            instructorId: 'instructor-1',
          },
        ]).then(onfulfilled),
      );

      const result = await verifyConsultationHandler({ data: { consultationId: 1 } });
      expect(result).toEqual({ success: true });
    });

    it('should reject if consultation is not in pending state', async () => {
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

      const result = await verifyConsultationHandler({ data: { consultationId: 1 } });
      expect(result).toEqual({
        error: { code: 'BAD_REQUEST', message: 'Consultation is not in pending state' },
      });
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

    it('should reject consultation successfully', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession);

      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([
          {
            id: 1,
            status: 'pending',
            studentId: 'student-1',
            assignmentId: 1,
            instructorId: 'instructor-1',
          },
        ]).then(onfulfilled),
      );

      const result = await rejectConsultationHandler({
        data: { consultationId: 1, reason: 'Insufficient detail' },
      });
      expect(result).toEqual({ success: true });
    });

    it('should reject if consultation is not in pending state', async () => {
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
        error: { code: 'BAD_REQUEST', message: 'Consultation is not in pending state' },
      });
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

  describe('listVerifiedCountsHandler', () => {
    it('should fail if unauthorized', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);
      const result = await listVerifiedCountsHandler({ data: { assignmentId: 1 } });
      expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
    });

    it('should return counts for student', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession);

      mockDb.then
        // Enrollment check
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ id: 1 }]).then(onfulfilled),
        )
        // Mock checkpoint query (with studentId filter)
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ id: 1, name: 'Ch 1', order: 1, minConsultations: 2 }]).then(
            onfulfilled,
          ),
        )
        // Mock count query
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ count: 1 }]).then(onfulfilled),
        );

      const result = (await listVerifiedCountsHandler({
        data: { assignmentId: 1 },
      })) as { counts: any[] };
      expect(result).toHaveProperty('counts');
      expect(result.counts).toHaveLength(1);
      expect(result.counts[0].verifiedCount).toBe(1);
    });

    it('should return counts for instructor', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession);

      mockDb.then
        // Assignment ownership check
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ id: 1 }]).then(onfulfilled),
        )
        // Mock checkpoint query for instructor (all students)
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ id: 1, name: 'Ch 1', order: 1, minConsultations: 2 }]).then(
            onfulfilled,
          ),
        )
        // Mock count query
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ count: 3 }]).then(onfulfilled),
        );

      const result = await listVerifiedCountsHandler({ data: { assignmentId: 1 } });
      expect(result).toHaveProperty('counts');
    });

    it('should reject if student is not enrolled for verified counts', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession);
      // Enrollment check returns empty
      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([]).then(onfulfilled),
      );
      const result = await listVerifiedCountsHandler({ data: { assignmentId: 999 } });
      expect(result).toEqual(serverError(ErrorCode.NOT_FOUND, 'Assignment not found'));
    });

    it('should reject if instructor does not own assignment for verified counts', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession);
      // Ownership check returns empty
      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([]).then(onfulfilled),
      );
      const result = await listVerifiedCountsHandler({ data: { assignmentId: 999 } });
      expect(result).toEqual(serverError(ErrorCode.NOT_FOUND, 'Assignment not found'));
    });
  });
});
