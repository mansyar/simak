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
  const instructorSession = {
    user: { id: 'instructor-1', role: 'instructor' },
    session: {},
  };
  let mockDb;
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {
      transaction: vi.fn(async (cb) => cb(mockDb)),
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
      then: vi.fn(function (onfulfilled) {
        return Promise.resolve([]).then(onfulfilled);
      }),
    };
    vi.mocked(dbMod.getDb).mockReturnValue(mockDb);
  });
  describe('createAssignmentHandler', () => {
    it('should write assignment.created audit entry on successful creation', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
        user: { id: 'instructor-1', role: 'instructor' },
        session: {},
      });
      // Mock returning to return inserted assignment id
      mockDb.returning.mockResolvedValue([{ id: 789 }]);
      // Mock then for select queries inside transaction
      mockDb.then.mockImplementationOnce((onfulfilled) => Promise.resolve([]).then(onfulfilled));
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
        user: { id: 'instructor-1', role: 'instructor' },
        session: {},
      });
      // Mock the initial ownership query via .then
      mockDb.then.mockImplementationOnce((onfulfilled) =>
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
      mockDb.then.mockImplementation((onfulfilled) => Promise.resolve([]).then(onfulfilled));
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
        user: { id: 'instructor-1', role: 'instructor' },
        session: {},
      });
      // Mock the initial ownership query
      mockDb.then.mockImplementationOnce((onfulfilled) =>
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
      mockDb.then.mockImplementation((onfulfilled) => Promise.resolve([]).then(onfulfilled));
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
  describe('extendDeadlineHandler', () => {
    it('should log deadline.extended audit event on successful extension', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession);
      const futureDate = new Date(Date.now() + 7 * 86400000);
      mockDb.then.mockImplementationOnce((onfulfilled) =>
        Promise.resolve([
          { id: 100, assignmentInstructorId: 'instructor-1', assignmentId: 1 },
        ]).then(onfulfilled),
      );
      const { extendDeadlineHandler } = await import('@/server/assignments.server');
      const result = await extendDeadlineHandler({
        data: { checkpointId: 100, newDueDate: futureDate },
      });
      expect(result).toEqual({ success: true });
      expect(auditMod.logAuditEvent).toHaveBeenCalledWith({
        actorId: 'instructor-1',
        action: 'deadline.extended',
        entityType: 'checkpoint',
        entityId: '100',
        details: { assignmentId: 1, newDueDate: futureDate.toISOString() },
      });
    });
    it('should not log audit event if checkpoint not found', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession);
      mockDb.then.mockImplementationOnce((onfulfilled) => Promise.resolve([]).then(onfulfilled));
      const { extendDeadlineHandler } = await import('@/server/assignments.server');
      await extendDeadlineHandler({
        data: { checkpointId: 999, newDueDate: new Date() },
      });
      expect(auditMod.logAuditEvent).not.toHaveBeenCalled();
    });
  });
  describe('unlockCheckpointHandler', () => {
    it('should log checkpoint.unlocked audit event on successful unlock', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession);
      mockDb.then.mockImplementationOnce((onfulfilled) =>
        Promise.resolve([
          { id: 100, state: 'locked', assignmentInstructorId: 'instructor-1', assignmentId: 1 },
        ]).then(onfulfilled),
      );
      const { unlockCheckpointHandler } = await import('@/server/assignments.server');
      const result = await unlockCheckpointHandler({ data: { checkpointId: 100 } });
      expect(result).toEqual({ success: true });
      expect(auditMod.logAuditEvent).toHaveBeenCalledWith({
        actorId: 'instructor-1',
        action: 'checkpoint.unlocked',
        entityType: 'checkpoint',
        entityId: '100',
        details: { assignmentId: 1 },
      });
    });
    it('should not log audit event if checkpoint already unlocked', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession);
      mockDb.then.mockImplementationOnce((onfulfilled) =>
        Promise.resolve([
          { id: 100, state: 'unlocked', assignmentInstructorId: 'instructor-1', assignmentId: 1 },
        ]).then(onfulfilled),
      );
      const { unlockCheckpointHandler } = await import('@/server/assignments.server');
      await unlockCheckpointHandler({ data: { checkpointId: 100 } });
      expect(auditMod.logAuditEvent).not.toHaveBeenCalled();
    });
  });
});
