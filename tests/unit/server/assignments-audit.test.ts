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

vi.mock('@/lib/sla', () => ({
  calculateBreachDuration: vi.fn().mockReturnValue(0),
  adjustDeadlinesForBreach: vi.fn(),
  dispatchSLABreachNotifications: vi.fn(),
}));

vi.mock('@tanstack/react-start', () => ({
  createServerFn: vi.fn().mockReturnValue({
    handler: vi.fn().mockImplementation((fn) => fn),
  }),
}));

describe('Assignment & Review handlers audit logging', () => {
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
      innerJoin: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      then: vi.fn(function (onfulfilled: any) {
        return Promise.resolve([]).then(onfulfilled);
      }),
    };
    vi.mocked(dbMod.getDb).mockReturnValue(mockDb as any);
  });

  describe('createAssignmentHandler', () => {
    it('should write assignment.created audit entry on successful creation', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
        user: { id: 'instructor-1', role: 'instructor' } as any,
        session: {} as any,
      });

      // Mock returning to return inserted assignment id
      mockDb.returning.mockResolvedValue([{ id: 789 }]);
      // Mock then for select queries inside transaction
      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([]).then(onfulfilled),
      );

      const { createAssignmentHandler } = await import('@/server/assignments.server');
      const result = await createAssignmentHandler({
        data: {
          templateId: 1,
          title: 'Test Assignment',
          description: 'A test assignment',
          finalDeadline: new Date('2026-12-31'),
          studentIds: ['student-1'],
        },
      });

      expect(result).toEqual({ success: true, assignmentId: 789 });
      expect(auditMod.logAuditEvent).toHaveBeenCalledWith({
        actorId: 'instructor-1',
        action: 'assignment.created',
        entityType: 'assignment',
        entityId: '789',
        details: { templateId: 1, studentCount: 1, deadline: expect.any(Date) },
      });
    });
  });

  describe('submitReviewHandler (pass)', () => {
    it('should write review.passed audit entry on pass decision', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
        user: { id: 'instructor-1', role: 'instructor' } as any,
        session: {} as any,
      });

      // Mock the initial ownership query via .then
      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([
          {
            checkpointId: 1,
            checkpointState: 'under_review',
            checkpointName: 'Chapter 1',
            assignmentId: 10,
            assignmentTitle: 'Thesis',
            instructorId: 'instructor-1',
            studentId: 'student-1',
            studentName: 'Student',
            checkpointUpdatedAt: new Date(),
            checkpointDueDate: new Date(),
            checkpointOrder: 1,
            finalDeadline: new Date('2026-12-31'),
          },
        ]).then(onfulfilled),
      );
      // Mock subsequent then calls (for nextCheckpoint lookup, etc.)
      mockDb.then.mockImplementation((onfulfilled: any) => Promise.resolve([]).then(onfulfilled));

      const { submitReviewHandler } = await import('@/server/reviews.server');
      const result = await submitReviewHandler({
        data: {
          submissionId: 100,
          decision: 'pass',
          comment: 'Great work!',
        },
      });

      // Debug: if handler returned error, that explains no audit event
      expect(result).not.toHaveProperty('error');
      expect(auditMod.logAuditEvent).toHaveBeenCalledWith({
        actorId: 'instructor-1',
        action: 'review.passed',
        entityType: 'review',
        entityId: '100',
        details: { checkpointName: 'Chapter 1', comment: 'Great work!' },
      });
    });
  });

  describe('submitReviewHandler (revise)', () => {
    it('should write review.revised audit entry on revise decision', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
        user: { id: 'instructor-1', role: 'instructor' } as any,
        session: {} as any,
      });

      // Mock the initial ownership query
      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([
          {
            checkpointId: 1,
            checkpointState: 'under_review',
            checkpointName: 'Chapter 1',
            assignmentId: 10,
            assignmentTitle: 'Thesis',
            instructorId: 'instructor-1',
            studentId: 'student-1',
            studentName: 'Student',
            checkpointUpdatedAt: new Date(),
            checkpointDueDate: new Date(),
            checkpointOrder: 1,
            finalDeadline: new Date('2026-12-31'),
          },
        ]).then(onfulfilled),
      );
      // Mock subsequent then calls
      mockDb.then.mockImplementation((onfulfilled: any) => Promise.resolve([]).then(onfulfilled));

      const { submitReviewHandler } = await import('@/server/reviews.server');
      await submitReviewHandler({
        data: {
          submissionId: 101,
          decision: 'revise',
          comment: 'Needs more detail',
          revisionDeadline: '2026-06-15',
        },
      });

      expect(auditMod.logAuditEvent).toHaveBeenCalledWith({
        actorId: 'instructor-1',
        action: 'review.revised',
        entityType: 'review',
        entityId: '101',
        details: { checkpointName: 'Chapter 1', revisionDeadline: '2026-06-15' },
      });
    });
  });
});
