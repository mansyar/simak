/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  saveRubricHandler,
  getRubricHandler,
  softDeleteCriterionHandler,
  softDeleteLevelHandler,
  countPendingReviewsHandler,
  fetchRubric,
} from '@/server/rubrics.server';
import { serverError, ErrorCode } from '@/lib/errors';
import type { RubricData } from '@/server/rubrics';
import { rubricCriteria, rubricLevels } from '@/db/schema/rubrics';
import { templateCheckpoints } from '@/db/schema/templates';
import * as auth from '@/server/auth';
import * as dbMod from '@/db/index';

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

describe('Rubric server handlers', () => {
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    transaction: vi.fn(async (cb: any) => cb(mockDb)),
    then: vi.fn(function (onfulfilled: any) {
      return Promise.resolve([]).then(onfulfilled);
    }),
  };

  const adminSession = {
    user: { id: 'admin-1', role: 'admin' } as any,
    session: {} as any,
  };

  const superAdminSession = {
    user: { id: 'super-1', role: 'superadmin' } as any,
    session: {} as any,
  };

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
    vi.restoreAllMocks();
    vi.mocked(dbMod.getDb).mockReturnValue(mockDb as any);
    // Reset then and transaction to clear mockImplementationOnce queue
    mockDb.then.mockReset();
    mockDb.then.mockImplementation(function (onfulfilled: any) {
      return Promise.resolve([]).then(onfulfilled);
    });
    mockDb.transaction.mockReset();
    mockDb.transaction.mockImplementation(async (cb: any) => cb(mockDb));
  });

  function mockThenOnce(data: any) {
    mockDb.then.mockImplementationOnce((onfulfilled: any) =>
      Promise.resolve(data).then(onfulfilled),
    );
  }

  // ── saveRubricHandler ──────────────────────────────────────────────

  describe('saveRubricHandler', () => {
    const numericRubric = {
      templateCheckpointId: 1,
      gradingType: 'numeric' as const,
      criteria: [
        { title: 'Criterion 1', weight: 60, order: 0 },
        { title: 'Criterion 2', weight: 40, order: 1 },
      ],
      levels: [],
    };

    it('should fail if unauthorized', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);
      const result = await saveRubricHandler({ data: numericRubric });
      expect(result).toEqual(serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized'));
    });

    it('should fail if student', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession);
      const result = await saveRubricHandler({ data: numericRubric });
      expect(result).toEqual(serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized'));
    });

    it('should fail if instructor (admin-only)', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession);
      const result = await saveRubricHandler({ data: numericRubric });
      expect(result).toEqual(serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized'));
    });

    it('should allow superadmin', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(superAdminSession);
      mockThenOnce([{ id: 1 }]);
      const result = await saveRubricHandler({ data: numericRubric });
      expect(result).toEqual({ success: true });
    });

    it('should return NOT_FOUND if checkpoint does not exist', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession);
      const result = await saveRubricHandler({ data: numericRubric });
      expect(result).toEqual(serverError(ErrorCode.NOT_FOUND, 'Template checkpoint not found'));
    });

    it('should save numeric rubric with new criteria', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession);
      mockThenOnce([{ id: 1 }]);

      const result = await saveRubricHandler({ data: numericRubric });

      expect(result).toEqual({ success: true });
      expect(mockDb.transaction).toHaveBeenCalled();
      expect(mockDb.update).toHaveBeenCalledWith(templateCheckpoints);
      expect(mockDb.insert).toHaveBeenCalledWith(rubricCriteria);
    });

    it('should save qualitative rubric with new criteria and levels', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession);
      mockThenOnce([{ id: 1 }]);

      const qualitativeRubric = {
        templateCheckpointId: 1,
        gradingType: 'qualitative' as const,
        criteria: [
          { title: 'Criterion 1', weight: 50, order: 0 },
          { title: 'Criterion 2', weight: 50, order: 1 },
        ],
        levels: [
          { label: 'Excellent', score: 90, order: 0 },
          { label: 'Good', score: 70, order: 1 },
        ],
      };

      const result = await saveRubricHandler({ data: qualitativeRubric });

      expect(result).toEqual({ success: true });
      expect(mockDb.insert).toHaveBeenCalledWith(rubricCriteria);
      expect(mockDb.insert).toHaveBeenCalledWith(rubricLevels);
    });

    it('should soft-delete existing criteria and levels when saving null gradingType', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession);
      mockThenOnce([{ id: 1 }]);

      const nullRubric = {
        templateCheckpointId: 1,
        gradingType: null,
        criteria: [],
        levels: [],
      };

      const result = await saveRubricHandler({ data: nullRubric });

      expect(result).toEqual({ success: true });
      expect(mockDb.update).toHaveBeenCalledWith(templateCheckpoints);
      expect(mockDb.update).toHaveBeenCalledWith(rubricCriteria);
      expect(mockDb.update).toHaveBeenCalledWith(rubricLevels);
      expect(mockDb.insert).not.toHaveBeenCalledWith(rubricCriteria);
    });

    it('should update existing criteria by ID and soft-delete removed', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession);
      mockThenOnce([{ id: 1 }]); // checkpoint exists
      mockThenOnce([]); // gradingType update
      mockThenOnce([{ id: 10 }, { id: 20 }]); // existing criteria

      const updateRubric = {
        templateCheckpointId: 1,
        gradingType: 'numeric' as const,
        criteria: [{ id: 10, title: 'Updated Criterion', weight: 100, order: 0 }],
        levels: [],
      };

      const result = await saveRubricHandler({ data: updateRubric });

      expect(result).toEqual({ success: true });
      expect(mockDb.update).toHaveBeenCalledWith(rubricCriteria);
      expect(mockDb.insert).not.toHaveBeenCalledWith(rubricCriteria);
    });

    it('should update existing levels by ID when qualitative', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession);
      mockThenOnce([{ id: 1 }]); // checkpoint exists
      mockThenOnce([]); // gradingType update
      mockThenOnce([]); // existing criteria (none)
      mockThenOnce([]); // insert new criteria (1 new criterion, no id)
      mockThenOnce([{ id: 5, label: 'Old Level', score: 50, order: 0 }]); // existing levels

      const qualitativeRubric = {
        templateCheckpointId: 1,
        gradingType: 'qualitative' as const,
        criteria: [{ title: 'Criterion 1', weight: 100, order: 0 }],
        levels: [{ id: 5, label: 'Updated Level', score: 80, order: 0 }],
      };

      const result = await saveRubricHandler({ data: qualitativeRubric });

      expect(result).toEqual({ success: true });
      expect(mockDb.update).toHaveBeenCalledWith(rubricLevels);
      expect(mockDb.insert).not.toHaveBeenCalledWith(rubricLevels);
    });

    it('should return INTERNAL error on transaction failure', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession);
      mockThenOnce([{ id: 1 }]);
      mockDb.transaction.mockRejectedValueOnce(new Error('DB error'));

      const result = await saveRubricHandler({ data: numericRubric });

      expect(result).toEqual(serverError(ErrorCode.INTERNAL, 'Internal Server Error'));
    });
  });

  // ── getRubricHandler ───────────────────────────────────────────────

  describe('getRubricHandler', () => {
    it('should fail if unauthorized', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);
      const result = await getRubricHandler({ data: { templateCheckpointId: 1 } });
      expect(result).toEqual(serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized'));
    });

    it('should fail if non-admin', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession);
      const result = await getRubricHandler({ data: { templateCheckpointId: 1 } });
      expect(result).toEqual(serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized'));
    });

    it('should return NOT_FOUND if checkpoint does not exist', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession);
      const result = await getRubricHandler({ data: { templateCheckpointId: 999 } });
      expect(result).toEqual(serverError(ErrorCode.NOT_FOUND, 'Template checkpoint not found'));
    });

    it('should return criteria and levels for numeric checkpoint', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession);
      mockThenOnce([{ gradingType: 'numeric' }]);
      mockThenOnce([
        { id: 1, title: 'Criterion 1', description: null, weight: 60, order: 0 },
        { id: 2, title: 'Criterion 2', description: null, weight: 40, order: 1 },
      ]);
      // levels query uses default [] (no levels for numeric)

      const result = await getRubricHandler({ data: { templateCheckpointId: 1 } });

      expect(result).not.toHaveProperty('error');
      const data = result as RubricData;
      expect(data.gradingType).toBe('numeric');
      expect(data.criteria).toHaveLength(2);
      expect(data.levels).toHaveLength(0);
    });

    it('should return criteria and levels for qualitative checkpoint', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession);
      mockThenOnce([{ gradingType: 'qualitative' }]);
      mockThenOnce([{ id: 1, title: 'Criterion 1', description: null, weight: 100, order: 0 }]);
      mockThenOnce([
        { id: 1, label: 'Excellent', description: null, score: 90, order: 0 },
        { id: 2, label: 'Good', description: null, score: 70, order: 1 },
      ]);

      const result = await getRubricHandler({ data: { templateCheckpointId: 1 } });

      const data = result as RubricData;
      expect(data.gradingType).toBe('qualitative');
      expect(data.criteria).toHaveLength(1);
      expect(data.levels).toHaveLength(2);
    });
  });

  // ── softDeleteCriterionHandler ────────────────────────────────────

  describe('softDeleteCriterionHandler', () => {
    it('should fail if unauthorized', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);
      const result = await softDeleteCriterionHandler({ data: { id: 1 } });
      expect(result).toEqual(serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized'));
    });

    it('should fail if non-admin', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession);
      const result = await softDeleteCriterionHandler({ data: { id: 1 } });
      expect(result).toEqual(serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized'));
    });

    it('should return NOT_FOUND if criterion does not exist', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession);
      const result = await softDeleteCriterionHandler({ data: { id: 999 } });
      expect(result).toEqual(serverError(ErrorCode.NOT_FOUND, 'Criterion not found'));
    });

    it('should soft-delete criterion', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession);
      mockThenOnce([{ id: 1 }]);

      const result = await softDeleteCriterionHandler({ data: { id: 1 } });

      expect(result).toEqual({ success: true });
      expect(mockDb.update).toHaveBeenCalledWith(rubricCriteria);
    });
  });

  // ── softDeleteLevelHandler ─────────────────────────────────────────

  describe('softDeleteLevelHandler', () => {
    it('should fail if unauthorized', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);
      const result = await softDeleteLevelHandler({ data: { id: 1 } });
      expect(result).toEqual(serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized'));
    });

    it('should fail if non-admin', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession);
      const result = await softDeleteLevelHandler({ data: { id: 1 } });
      expect(result).toEqual(serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized'));
    });

    it('should return NOT_FOUND if level does not exist', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession);
      const result = await softDeleteLevelHandler({ data: { id: 999 } });
      expect(result).toEqual(serverError(ErrorCode.NOT_FOUND, 'Level not found'));
    });

    it('should soft-delete level', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession);
      mockThenOnce([{ id: 1 }]);

      const result = await softDeleteLevelHandler({ data: { id: 1 } });

      expect(result).toEqual({ success: true });
      expect(mockDb.update).toHaveBeenCalledWith(rubricLevels);
    });
  });

  // ── countPendingReviewsHandler ────────────────────────────────────

  describe('countPendingReviewsHandler', () => {
    it('should fail if unauthorized', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);
      const result = await countPendingReviewsHandler({ data: { templateCheckpointId: 1 } });
      expect(result).toEqual(serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized'));
    });

    it('should fail if non-admin', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession);
      const result = await countPendingReviewsHandler({ data: { templateCheckpointId: 1 } });
      expect(result).toEqual(serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized'));
    });

    it('should return count of pending reviews', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession);
      mockThenOnce([{ count: 3 }]);

      const result = await countPendingReviewsHandler({ data: { templateCheckpointId: 1 } });

      expect(result).toEqual({ count: 3 });
    });

    it('should return 0 when no pending reviews', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession);
      mockThenOnce([{ count: 0 }]);

      const result = await countPendingReviewsHandler({ data: { templateCheckpointId: 1 } });

      expect(result).toEqual({ count: 0 });
    });

    it('should allow superadmin', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(superAdminSession);
      mockThenOnce([{ count: 5 }]);

      const result = await countPendingReviewsHandler({ data: { templateCheckpointId: 1 } });

      expect(result).toEqual({ count: 5 });
    });

    it('should return INTERNAL error on failure', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession);
      mockDb.then.mockImplementationOnce(() => {
        throw new Error('DB error');
      });

      const result = await countPendingReviewsHandler({ data: { templateCheckpointId: 1 } });

      expect(result).toEqual(serverError(ErrorCode.INTERNAL, 'Internal Server Error'));
    });
  });

  // ── fetchRubric ────────────────────────────────────────────────────

  describe('fetchRubric', () => {
    it('should return null when checkpoint not found', async () => {
      mockThenOnce([]);

      const result = await fetchRubric(mockDb as any, 1);

      expect(result).toBeNull();
    });

    it('should return null when gradingType is null', async () => {
      mockThenOnce([{ gradingType: null }]);

      const result = await fetchRubric(mockDb as any, 1);

      expect(result).toBeNull();
    });

    it('should return criteria with empty levels when gradingType is numeric', async () => {
      mockThenOnce([{ gradingType: 'numeric' }]);
      mockThenOnce([
        { id: 1, title: 'Criterion 1', description: null, weight: 60, order: 0 },
        { id: 2, title: 'Criterion 2', description: 'desc', weight: 40, order: 1 },
      ]);

      const result = await fetchRubric(mockDb as any, 1);

      expect(result).toEqual({
        gradingType: 'numeric',
        criteria: [
          { id: 1, title: 'Criterion 1', description: null, weight: 60, order: 0 },
          { id: 2, title: 'Criterion 2', description: 'desc', weight: 40, order: 1 },
        ],
        levels: [],
      });
    });

    it('should return criteria and levels when gradingType is qualitative', async () => {
      mockThenOnce([{ gradingType: 'qualitative' }]);
      mockThenOnce([{ id: 1, title: 'C1', description: null, weight: 100, order: 0 }]);
      mockThenOnce([
        { id: 1, label: 'Excellent', description: null, score: 100, order: 0 },
        { id: 2, label: 'Good', description: 'desc', score: 75, order: 1 },
      ]);

      const result = await fetchRubric(mockDb as any, 1);

      expect(result).toEqual({
        gradingType: 'qualitative',
        criteria: [{ id: 1, title: 'C1', description: null, weight: 100, order: 0 }],
        levels: [
          { id: 1, label: 'Excellent', description: null, score: 100, order: 0 },
          { id: 2, label: 'Good', description: 'desc', score: 75, order: 1 },
        ],
      });
    });
  });
});
