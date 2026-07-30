/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as auth from '@/server/auth';
import * as dbMod from '@/db/index';
import * as auditMod from '@/lib/audit';

vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn(),
}));

vi.mock('@/db/index', () => ({
  getDb: vi.fn(),
}));

vi.mock('@/lib/audit', () => ({
  logAuditEvent: vi.fn(),
}));

vi.mock('@tanstack/react-start', () => ({
  createServerFn: vi.fn().mockReturnValue({
    middleware: vi.fn().mockReturnThis(),
    inputValidator: vi.fn().mockReturnThis(),
    handler: vi.fn().mockImplementation((fn) => fn),
  }),
  createMiddleware: vi.fn().mockReturnValue({
    server: vi.fn().mockImplementation((fn) => fn),
  }),
}));

describe('Consultation handlers audit logging', () => {
  const mockDb: any = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    for: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    then: vi.fn(function (onfulfilled: any) {
      return Promise.resolve([]).then(onfulfilled);
    }),
  };

  mockDb.transaction = vi.fn().mockImplementation(async (callback: any) => callback(mockDb));

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dbMod.getDb).mockReturnValue(mockDb as any);
  });

  describe('verifyConsultationHandler', () => {
    it('should write consultation.verified audit entry on successful verification', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
        user: { id: 'instructor-1', role: 'instructor' } as any,
        session: {} as any,
      });

      // Mock the consultation fetch query
      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([
          {
            id: 55,
            status: 'pending',
            studentId: 'student-1',
            assignmentId: 10,
            instructorId: 'instructor-1',
          },
        ]).then(onfulfilled),
      );

      const { verifyConsultationHandler } = await import('@/server/consultations.server');
      const result = await verifyConsultationHandler({
        data: { consultationId: 55 },
      });

      expect(result).toEqual({ success: true });
      expect(auditMod.logAuditEvent).toHaveBeenCalledWith({
        actorId: 'instructor-1',
        action: 'consultation.verified',
        entityType: 'consultation',
        entityId: '55',
        details: { checkpoint: 10, student: 'student-1' },
      });
    });
  });

  describe('rejectConsultationHandler', () => {
    it('should write consultation.rejected audit entry on successful rejection', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
        user: { id: 'instructor-1', role: 'instructor' } as any,
        session: {} as any,
      });

      // Mock the consultation fetch query
      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([
          {
            id: 66,
            status: 'pending',
            studentId: 'student-1',
            assignmentId: 10,
            instructorId: 'instructor-1',
          },
        ]).then(onfulfilled),
      );

      const { rejectConsultationHandler } = await import('@/server/consultations.server');
      const result = await rejectConsultationHandler({
        data: { consultationId: 66, reason: 'Missing documentation' },
      });

      expect(result).toEqual({ success: true });
      expect(auditMod.logAuditEvent).toHaveBeenCalledWith({
        actorId: 'instructor-1',
        action: 'consultation.rejected',
        entityType: 'consultation',
        entityId: '66',
        details: { checkpoint: 10, student: 'student-1', reason: 'Missing documentation' },
      });
    });
  });
});
