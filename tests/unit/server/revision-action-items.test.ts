/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  insertRevisionActionItems,
  updateRevisionActionItemHandler,
} from '@/server/revision-action-items.server';
import { revisionActionItems } from '@/db/schema/revision-action-items';
import * as auth from '@/server/auth';
import * as dbMod from '@/db/index';
import { isServerError } from '@/lib/errors';

const auditMocks = vi.hoisted(() => {
  const logAuditEvent = vi.fn().mockResolvedValue(undefined);
  const safeAuditLog = vi.fn(async (_label: string, event: unknown) => {
    try {
      await logAuditEvent(event);
    } catch {
      // Advisory audit failures must not fail the status mutation.
    }
  });
  return { logAuditEvent, safeAuditLog };
});

vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn(),
}));

vi.mock('@/db/index', () => ({
  getDb: vi.fn(),
}));

vi.mock('@/lib/audit', () => auditMocks);

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn() },
}));

describe('Revision action-item server helpers', () => {
  let mockDb: any;
  let mockTx: any;

  const instructorSession = {
    user: { id: 'instructor-1', role: 'instructor' as const },
    session: {} as any,
  };
  const studentSession = {
    user: { id: 'student-1', role: 'student' as const },
    session: {} as any,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockTx = createChain();
    mockDb = createChain();
    mockDb.transaction = vi.fn(async (callback: (tx: any) => Promise<unknown>) => callback(mockTx));
    vi.mocked(dbMod.getDb).mockReturnValue(mockDb as any);
  });

  describe('insertRevisionActionItems', () => {
    it('rejects a criterion that belongs to another checkpoint rubric', async () => {
      mockTx.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ id: 7, title: 'Other rubric', templateCheckpointId: 99 }]).then(
          onfulfilled,
        ),
      );

      const result = await insertRevisionActionItems(mockTx, {
        reviewId: 42,
        templateCheckpointId: 5,
        actionItems: [{ itemText: 'Fix the structure', criterionId: 7 }],
      });

      expect(isServerError(result)).toBe(true);
      if (isServerError(result)) expect(result.error.code).toBe('BAD_REQUEST');
      expect(mockTx.insert).not.toHaveBeenCalled();
    });

    it('accepts criterionless items for a checkpoint without a rubric', async () => {
      const result = await insertRevisionActionItems(mockTx, {
        reviewId: 42,
        templateCheckpointId: null,
        actionItems: [{ itemText: 'Add a conclusion' }],
      });

      expect(result).not.toHaveProperty('error');
      expect(mockTx.insert).toHaveBeenCalledWith(revisionActionItems);
      expect(mockTx.values).toHaveBeenCalledWith([
        {
          reviewId: 42,
          itemText: 'Add a conclusion',
          order: 0,
          criterionId: null,
          criterionTitle: null,
        },
      ]);
    });

    it('rejects criterion links when the checkpoint has no rubric', async () => {
      const result = await insertRevisionActionItems(mockTx, {
        reviewId: 42,
        templateCheckpointId: null,
        actionItems: [{ itemText: 'Use evidence', criterionId: 7 }],
      });

      expect(isServerError(result)).toBe(true);
      if (isServerError(result)) expect(result.error.code).toBe('BAD_REQUEST');
      expect(mockTx.insert).not.toHaveBeenCalled();
    });

    it('snapshots criterion titles and preserves submitted order', async () => {
      mockTx.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ id: 7, title: 'Structure', templateCheckpointId: 5 }]).then(onfulfilled),
      );

      await insertRevisionActionItems(mockTx, {
        reviewId: 42,
        templateCheckpointId: 5,
        actionItems: [
          { itemText: 'Rework the outline', criterionId: 7 },
          { itemText: 'Add supporting evidence' },
        ],
      });

      expect(mockTx.values).toHaveBeenCalledWith([
        {
          reviewId: 42,
          itemText: 'Rework the outline',
          order: 0,
          criterionId: 7,
          criterionTitle: 'Structure',
        },
        {
          reviewId: 42,
          itemText: 'Add supporting evidence',
          order: 1,
          criterionId: null,
          criterionTitle: null,
        },
      ]);
    });
  });

  describe('updateRevisionActionItemHandler', () => {
    const currentItem: {
      id: number;
      reviewId: number;
      checkpointId: number;
      studentId: string;
      decision: string;
      checkpointState: string;
      itemText: string;
      addressedAt: Date | null;
      isCurrentPlan: boolean;
    } = {
      id: 11,
      reviewId: 42,
      checkpointId: 100,
      studentId: 'student-1',
      decision: 'revise',
      checkpointState: 'revise',
      itemText: 'Rewrite the conclusion',
      addressedAt: null,
      isCurrentPlan: true,
    };

    function allowCurrentItem(item = currentItem) {
      for (const query of [mockDb, mockTx]) {
        query.then.mockImplementation((onfulfilled: any) =>
          Promise.resolve([item]).then(onfulfilled),
        );
      }
    }

    function rejectCurrentItem() {
      for (const query of [mockDb, mockTx]) {
        query.then.mockImplementation((onfulfilled: any) => Promise.resolve([]).then(onfulfilled));
      }
    }

    it('allows the owning student to mark a current item addressed', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);
      allowCurrentItem();

      const result = await updateRevisionActionItemHandler({
        data: { itemId: 11, addressed: true },
      });

      expect(result).toEqual({ success: true });
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      expect(mockTx.update).toHaveBeenCalledWith(revisionActionItems);
      expect(mockTx.set).toHaveBeenCalledWith(
        expect.objectContaining({ addressedAt: expect.any(Date) }),
      );
    });

    it('allows the owning student to unmark a current item', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);
      allowCurrentItem({ ...currentItem, addressedAt: new Date('2026-08-01') });

      const result = await updateRevisionActionItemHandler({
        data: { itemId: 11, addressed: false },
      });

      expect(result).toEqual({ success: true });
      expect(mockTx.set).toHaveBeenCalledWith(expect.objectContaining({ addressedAt: null }));
    });

    it('rejects unauthenticated and instructor status mutations', async () => {
      for (const session of [null, instructorSession]) {
        vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(session as any);

        const result = await updateRevisionActionItemHandler({
          data: { itemId: 11, addressed: true },
        });

        expect(isServerError(result)).toBe(true);
        if (isServerError(result)) expect(result.error.code).toBe('UNAUTHORIZED');
        expect(mockDb.transaction).not.toHaveBeenCalled();
        vi.clearAllMocks();
      }
    });

    it('rejects a student who does not own the checkpoint', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
        ...studentSession,
        user: { ...studentSession.user, id: 'student-2' },
      } as any);
      allowCurrentItem();

      const result = await updateRevisionActionItemHandler({
        data: { itemId: 11, addressed: true },
      });

      expect(isServerError(result)).toBe(true);
      expect(mockTx.update).not.toHaveBeenCalled();
    });

    it('rejects status changes for a superseded plan', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);
      allowCurrentItem({ ...currentItem, isCurrentPlan: false });

      const result = await updateRevisionActionItemHandler({
        data: { itemId: 11, addressed: true },
      });

      expect(isServerError(result)).toBe(true);
      expect(mockTx.update).not.toHaveBeenCalled();
    });

    it('keeps addressed-status updates successful when advisory audit logging fails', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);
      allowCurrentItem();
      auditMocks.logAuditEvent.mockRejectedValueOnce(new Error('audit service down'));

      const result = await updateRevisionActionItemHandler({
        data: { itemId: 11, addressed: true },
      });

      expect(result).toEqual({ success: true });
      expect(auditMocks.logAuditEvent).toHaveBeenCalled();
      const event = auditMocks.logAuditEvent.mock.calls[0][0] as any;
      expect(event.details).toEqual(
        expect.objectContaining({ itemId: 11, reviewId: 42, addressed: true }),
      );
      expect(event.details).not.toHaveProperty('itemText');
      expect(JSON.stringify(event.details)).not.toContain(currentItem.itemText);
    });
  });
});

function createChain() {
  return {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    for: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    then: vi.fn((onfulfilled: any) => Promise.resolve([]).then(onfulfilled)),
  };
}
