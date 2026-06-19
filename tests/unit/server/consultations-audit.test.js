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
    handler: vi.fn().mockImplementation((fn) => fn),
  }),
}));
describe('Consultation handlers audit logging', () => {
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    then: vi.fn(function (onfulfilled) {
      return Promise.resolve([]).then(onfulfilled);
    }),
  };
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dbMod.getDb).mockReturnValue(mockDb);
  });
  describe('verifyConsultationHandler', () => {
    it('should write consultation.verified audit entry on successful verification', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
        user: { id: 'instructor-1', role: 'instructor' },
        session: {},
      });
      // Mock the consultation fetch query
      mockDb.then.mockImplementationOnce((onfulfilled) =>
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
        user: { id: 'instructor-1', role: 'instructor' },
        session: {},
      });
      // Mock the consultation fetch query
      mockDb.then.mockImplementationOnce((onfulfilled) =>
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
