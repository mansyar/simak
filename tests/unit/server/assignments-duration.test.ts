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

describe('Assignment duration calculation', () => {
  let mockDb: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {
      transaction: vi.fn(async (cb: any) => cb(mockDb)),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      then: vi.fn(function (onfulfilled: any) {
        return Promise.resolve([]).then(onfulfilled);
      }),
    };
    vi.mocked(dbMod.getDb).mockReturnValue(mockDb as any);
  });

  describe('createAssignmentHandler', () => {
    it('should create assignment and write audit log', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
        user: { id: 'instructor-1', role: 'instructor' } as any,
        session: {} as any,
      });

      mockDb.returning.mockResolvedValue([{ id: 789 }]);
      const checkpointsData = [
        { name: 'CP1', order: 1, minConsultations: 1, estimatedDuration: 7 },
        { name: 'CP2', order: 2, minConsultations: 2, estimatedDuration: 14 },
        { name: 'CP3', order: 3, minConsultations: 1, estimatedDuration: 21 },
      ];
      // 1st await mockDb: student insert (unused result)
      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve(checkpointsData).then(onfulfilled),
      );
      // 2nd await mockDb: template checkpoints query
      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve(checkpointsData).then(onfulfilled),
      );
      // 3rd await mockDb: assignment createdAt query
      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ createdAt: new Date('2026-07-01T00:00:00Z') }]).then(onfulfilled),
      );

      const { createAssignmentHandler } = await import('@/server/assignments.server');
      const result = await createAssignmentHandler({
        data: {
          templateId: 1,
          title: 'Thesis Assignment',
          description: 'Test',
          finalDeadline: new Date('2026-12-31'),
          studentIds: ['student-1'],
        },
      });

      expect(result).not.toHaveProperty('error');
      expect(result).toHaveProperty('success', true);
      expect(auditMod.logAuditEvent).toHaveBeenCalledWith({
        actorId: 'instructor-1',
        action: 'assignment.created',
        entityType: 'assignment',
        entityId: '789',
        details: { templateId: 1, studentCount: 1, deadline: expect.any(Date) },
      });
    });
  });
});
