/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  verifyConsultationHandler,
  rejectConsultationHandler,
} from '@/server/consultations.server';
import * as auth from '@/server/auth';
import * as dbMod from '@/db/index';
import { isServerError } from '@/lib/errors';

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

vi.mock('@/lib/audit', () => ({
  logAuditEvent: vi.fn(),
}));

function createMockDb() {
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

  mockDb.transaction = vi.fn().mockImplementation(async (callback: any) => {
    return callback(mockDb);
  });

  return mockDb;
}

const instructorSession = {
  user: { id: 'instructor-1', role: 'instructor' as const },
  session: {} as any,
};

const pendingConsultation = {
  id: 1,
  status: 'pending',
  studentId: 'student-1',
  assignmentId: 101,
  instructorId: 'instructor-1',
};

describe('Consultation handlers — transactional wrapping', () => {
  let mockDb: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    vi.mocked(dbMod.getDb).mockReturnValue(mockDb);
  });

  describe('verifyConsultationHandler', () => {
    it('should wrap update and notification in db.transaction', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([pendingConsultation]).then(onfulfilled),
      );

      const result = await verifyConsultationHandler({ data: { consultationId: 1 } });

      expect(result).toEqual({ success: true });
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      expect(mockDb.transaction).toHaveBeenCalledWith(expect.any(Function));
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should return an error when the transaction fails (notification insert fails)', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([pendingConsultation]).then(onfulfilled),
      );
      mockDb.transaction.mockImplementationOnce(async (_callback: any) => {
        throw new Error('unique violation on notifications');
      });

      const result = await verifyConsultationHandler({ data: { consultationId: 1 } });

      expect(isServerError(result)).toBe(true);
      if (!isServerError(result)) throw new Error('Expected server error');
      expect(result.error.code).toBe('INTERNAL');
    });

    it('should return success when post-commit audit logging fails', async () => {
      const { logAuditEvent } = await import('@/lib/audit');
      vi.mocked(logAuditEvent).mockRejectedValueOnce(new Error('audit service down'));
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([pendingConsultation]).then(onfulfilled),
      );

      const result = await verifyConsultationHandler({ data: { consultationId: 1 } });

      expect(result).toEqual({ success: true });
      expect(logAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'consultation.verified',
          entityType: 'consultation',
        }),
      );
    });
  });

  describe('rejectConsultationHandler', () => {
    it('should wrap update and notification in db.transaction', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([pendingConsultation]).then(onfulfilled),
      );

      const result = await rejectConsultationHandler({
        data: { consultationId: 1, reason: 'Insufficient detail' },
      });

      expect(result).toEqual({ success: true });
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should return an error when the transaction fails (notification insert fails)', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([pendingConsultation]).then(onfulfilled),
      );
      mockDb.transaction.mockImplementationOnce(async (_callback: any) => {
        throw new Error('unique violation on notifications');
      });

      const result = await rejectConsultationHandler({
        data: { consultationId: 1, reason: 'Insufficient detail' },
      });

      expect(isServerError(result)).toBe(true);
      if (!isServerError(result)) throw new Error('Expected server error');
      expect(result.error.code).toBe('INTERNAL');
    });

    it('should return success when post-commit audit logging fails', async () => {
      const { logAuditEvent } = await import('@/lib/audit');
      vi.mocked(logAuditEvent).mockRejectedValueOnce(new Error('audit service down'));
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([pendingConsultation]).then(onfulfilled),
      );

      const result = await rejectConsultationHandler({
        data: { consultationId: 1, reason: 'Insufficient detail' },
      });

      expect(result).toEqual({ success: true });
      expect(logAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'consultation.rejected',
          entityType: 'consultation',
        }),
      );
    });
  });
});
