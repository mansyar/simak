/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getStudentFinalGradeHandler,
  getAssignmentGradebookHandler,
  recomputeAllGradesHandler,
} from '@/server/gradebook.server';
import { isServerError } from '@/lib/errors';
import * as auth from '@/server/auth';
import * as dbMod from '@/db/index';

vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn(),
}));

vi.mock('@/db/index', () => ({
  getDb: vi.fn(),
}));

// ---- Session Fixtures ----

const adminSession = {
  user: { id: 'admin-1', name: 'Admin', role: 'admin' as const },
  session: {} as any,
};

const instructorSession = {
  user: { id: 'instructor-1', name: 'Instructor', role: 'instructor' as const },
  session: {} as any,
};

const studentSession = {
  user: { id: 'student-1', name: 'Student', role: 'student' as const },
  session: {} as any,
};

// ---- Mock DB Factory ----

function createMockDb() {
  const mock: any = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    transaction: vi.fn(async (cb: any) => cb(mock)),
    then: vi.fn(function (this: any, onfulfilled: any) {
      return Promise.resolve([]).then(onfulfilled);
    }),
  };
  return mock;
}

// ---- Tests ----

describe('Gradebook Server Handlers', () => {
  let mockDb: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    vi.mocked(dbMod.getDb).mockReturnValue(mockDb as any);
  });

  describe('getStudentFinalGradeHandler', () => {
    it('should reject if unauthorized', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);
      const result = await getStudentFinalGradeHandler({ data: { assignmentId: 1 } });
      expect(isServerError(result)).toBe(true);
      if (isServerError(result)) expect(result.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject if student does not own the assignment', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);
      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([]).then(onfulfilled),
      );
      const result = await getStudentFinalGradeHandler({ data: { assignmentId: 999 } });
      expect(isServerError(result)).toBe(true);
      if (isServerError(result)) expect(result.error.code).toBe('NOT_FOUND');
    });

    it('should return null when no grade config exists (does NOT auto-create on read)', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);
      mockDb.then
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ assignmentId: 1 }]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled));
      const result = await getStudentFinalGradeHandler({ data: { assignmentId: 1 } });
      expect(result).toBeNull();
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('should return computed grade with checkpoints and config', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);
      mockDb.then
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ assignmentId: 1 }]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([
            {
              gradingScheme: 'equal_weight',
              customWeights: null,
              letterGradeBounds: { A: 90, B: 80, C: 70, D: 60 },
            },
          ]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([
            {
              checkpointId: 1,
              checkpointName: 'Chapter 1',
              templateCheckpointId: 10,
              order: 1,
              state: 'passed',
              gradingType: null,
              criterionId: null,
              criterionTitle: null,
              score: null,
              weight: null,
              rubricLevelId: null,
              levelLabel: null,
            },
            {
              checkpointId: 2,
              checkpointName: 'Chapter 2',
              templateCheckpointId: 20,
              order: 2,
              state: 'passed',
              gradingType: 'numeric',
              criterionId: 5,
              criterionTitle: 'Content Quality',
              score: 85,
              weight: 50,
              rubricLevelId: 3,
              levelLabel: 'Good',
            },
            {
              checkpointId: 2,
              checkpointName: 'Chapter 2',
              templateCheckpointId: 20,
              order: 2,
              state: 'passed',
              gradingType: 'numeric',
              criterionId: 6,
              criterionTitle: 'Structure',
              score: 90,
              weight: 50,
              rubricLevelId: null,
              levelLabel: null,
            },
          ]).then(onfulfilled),
        );

      const result = (await getStudentFinalGradeHandler({ data: { assignmentId: 1 } })) as any;
      expect(result).not.toBeNull();
      expect(result.status).toBe('complete');
      expect(result.numericScore).toBe(93.75);
      expect(result.letterGrade).toBe('A');
      expect(result.contributingCheckpoints).toHaveLength(2);
      expect(result.staleWeights).toBe(false);
    });
  });

  describe('getAssignmentGradebookHandler', () => {
    it('should reject if unauthorized', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);
      const result = await getAssignmentGradebookHandler({ data: { assignmentId: 1 } });
      expect(isServerError(result)).toBe(true);
      if (isServerError(result)) expect(result.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject if instructor does not own the assignment', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([]).then(onfulfilled),
      );
      const result = await getAssignmentGradebookHandler({ data: { assignmentId: 999 } });
      expect(isServerError(result)).toBe(true);
      if (isServerError(result)) expect(result.error.code).toBe('NOT_FOUND');
    });

    it('should return all students with per-checkpoint scores, sorted by name', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
      mockDb.then
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ id: 1, instructorId: 'instructor-1' }]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([
            {
              gradingScheme: 'equal_weight',
              customWeights: null,
              letterGradeBounds: { A: 90, B: 80, C: 70, D: 60 },
            },
          ]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([
            {
              studentId: 'student-2',
              studentName: 'Bob',
              checkpointId: 1,
              checkpointName: 'Chapter 1',
              templateCheckpointId: 10,
              order: 1,
              state: 'passed',
              gradingType: null,
              criterionId: null,
              criterionTitle: null,
              score: null,
              weight: null,
              rubricLevelId: null,
              levelLabel: null,
            },
            {
              studentId: 'student-1',
              studentName: 'Alice',
              checkpointId: 1,
              checkpointName: 'Chapter 1',
              templateCheckpointId: 10,
              order: 1,
              state: 'passed',
              gradingType: null,
              criterionId: null,
              criterionTitle: null,
              score: null,
              weight: null,
              rubricLevelId: null,
              levelLabel: null,
            },
          ]).then(onfulfilled),
        );

      const result = (await getAssignmentGradebookHandler({ data: { assignmentId: 1 } })) as any;
      expect(result.students).toHaveLength(2);
      expect(result.students[0].studentName).toBe('Alice');
      expect(result.students[1].studentName).toBe('Bob');
      expect(result.students[0].checkpoints).toHaveLength(1);
      expect(result.students[0].finalGrade.status).toBe('complete');
      expect(result.students[0].finalGrade.numericScore).toBe(100);
      expect(result.students[0].finalGrade.letterGrade).toBe('A');
      expect(result.config.gradingScheme).toBe('equal_weight');
    });

    it('should return null config when no grade config exists', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
      mockDb.then
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ id: 1, instructorId: 'instructor-1' }]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled))
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([
            {
              studentId: 'student-1',
              studentName: 'Alice',
              checkpointId: 1,
              checkpointName: 'Chapter 1',
              templateCheckpointId: 10,
              order: 1,
              state: 'passed',
              gradingType: null,
              criterionId: null,
              criterionTitle: null,
              score: null,
              weight: null,
              rubricLevelId: null,
              levelLabel: null,
            },
          ]).then(onfulfilled),
        );

      const result = (await getAssignmentGradebookHandler({ data: { assignmentId: 1 } })) as any;
      expect(result.config).toBeNull();
      expect(result.students).toHaveLength(1);
      expect(result.students[0].finalGrade).toBeNull();
    });
  });

  describe('recomputeAllGradesHandler', () => {
    it('should reject if unauthorized', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);
      const result = await recomputeAllGradesHandler({ data: { assignmentId: 1 } });
      expect(isServerError(result)).toBe(true);
      if (isServerError(result)) expect(result.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject if instructor (not admin)', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
      const result = await recomputeAllGradesHandler({ data: { assignmentId: 1 } });
      expect(isServerError(result)).toBe(true);
      if (isServerError(result)) expect(result.error.code).toBe('UNAUTHORIZED');
    });

    it('should recompute all students final grades and return count', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession as any);
      mockDb.then
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([
            { studentId: 'student-1', studentName: 'Bob' },
            { studentId: 'student-2', studentName: 'Alice' },
          ]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([
            {
              gradingScheme: 'equal_weight',
              customWeights: null,
              letterGradeBounds: { A: 90, B: 80, C: 70, D: 60 },
            },
          ]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([
            {
              studentId: 'student-1',
              studentName: 'Bob',
              checkpointId: 1,
              checkpointName: 'Chapter 1',
              templateCheckpointId: 10,
              order: 1,
              state: 'passed',
              gradingType: null,
              criterionId: null,
              criterionTitle: null,
              score: null,
              weight: null,
              rubricLevelId: null,
              levelLabel: null,
            },
            {
              studentId: 'student-2',
              studentName: 'Alice',
              checkpointId: 1,
              checkpointName: 'Chapter 1',
              templateCheckpointId: 10,
              order: 1,
              state: 'passed',
              gradingType: null,
              criterionId: null,
              criterionTitle: null,
              score: null,
              weight: null,
              rubricLevelId: null,
              levelLabel: null,
            },
          ]).then(onfulfilled),
        );

      const result = (await recomputeAllGradesHandler({ data: { assignmentId: 1 } })) as any;
      expect(result.success).toBe(true);
      expect(result.count).toBe(2);
      expect(mockDb.insert).toHaveBeenCalledTimes(2);
    });
  });
});
