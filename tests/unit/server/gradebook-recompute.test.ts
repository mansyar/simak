/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { recomputeStudentGrade } from '@/server/reviews-extras.server';
import { finalGrades } from '@/db/schema/gradebook';

vi.mock('@/server/auth', () => ({ getSessionFromHeaders: vi.fn() }));
vi.mock('@/db/index', () => ({ getDb: vi.fn() }));
vi.mock('@/server/ownership', () => ({ verifyCheckpointAccess: vi.fn() }));
vi.mock('@/lib/i18n-server', () => ({ translateKey: vi.fn().mockReturnValue('translated') }));
vi.mock('@/lib/audit', () => ({ logAuditEvent: vi.fn() }));

function createMockDb() {
  return {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockReturnThis(),
    then: vi.fn(),
  };
}

describe('recomputeStudentGrade', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should compute and upsert final grade when config exists (pass/fail checkpoint passed)', async () => {
    const mockDb = createMockDb();

    // 1. Config query returns an equal_weight config
    mockDb.then.mockImplementationOnce((onfulfilled) =>
      Promise.resolve([
        {
          gradingScheme: 'equal_weight',
          customWeights: null,
          letterGradeBounds: { A: 90, B: 80, C: 70, D: 60 },
        },
      ]).then(onfulfilled),
    );

    // 2. Checkpoint query returns one pass/fail checkpoint with state 'passed'
    mockDb.then.mockImplementationOnce((onfulfilled) =>
      Promise.resolve([
        {
          checkpointId: 1,
          checkpointName: 'CP1',
          templateCheckpointId: 1,
          order: 0,
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

    // 3. Upsert result
    mockDb.then.mockImplementationOnce((onfulfilled) => Promise.resolve([]).then(onfulfilled));

    await recomputeStudentGrade(mockDb as any, 1, 'student-1');

    expect(mockDb.insert).toHaveBeenCalledWith(finalGrades);
    expect(mockDb.values).toHaveBeenCalledWith(
      expect.objectContaining({
        assignmentId: 1,
        studentId: 'student-1',
        numericScore: '100',
        letterGrade: 'A',
        status: 'complete',
      }),
    );
  });

  it('should skip upsert when no grade config exists', async () => {
    const mockDb = createMockDb();

    // Config query returns empty (no config)
    mockDb.then.mockImplementationOnce((onfulfilled) => Promise.resolve([]).then(onfulfilled));

    await recomputeStudentGrade(mockDb as any, 1, 'student-1');

    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it('should handle student with no checkpoints (status incomplete, null score)', async () => {
    const mockDb = createMockDb();

    // 1. Config exists
    mockDb.then.mockImplementationOnce((onfulfilled) =>
      Promise.resolve([
        {
          gradingScheme: 'equal_weight',
          customWeights: null,
          letterGradeBounds: { A: 90, B: 80, C: 70, D: 60 },
        },
      ]).then(onfulfilled),
    );

    // 2. No checkpoints returned
    mockDb.then.mockImplementationOnce((onfulfilled) => Promise.resolve([]).then(onfulfilled));

    // 3. Upsert result
    mockDb.then.mockImplementationOnce((onfulfilled) => Promise.resolve([]).then(onfulfilled));

    await recomputeStudentGrade(mockDb as any, 1, 'student-1');

    expect(mockDb.insert).toHaveBeenCalledWith(finalGrades);
    expect(mockDb.values).toHaveBeenCalledWith(
      expect.objectContaining({
        assignmentId: 1,
        studentId: 'student-1',
        numericScore: null,
        letterGrade: null,
        status: 'incomplete',
      }),
    );
  });

  it('should compute rubric checkpoint scores correctly', async () => {
    const mockDb = createMockDb();

    // 1. Config exists (equal_weight)
    mockDb.then.mockImplementationOnce((onfulfilled) =>
      Promise.resolve([
        {
          gradingScheme: 'equal_weight',
          customWeights: null,
          letterGradeBounds: { A: 90, B: 80, C: 70, D: 60 },
        },
      ]).then(onfulfilled),
    );

    // 2. One rubric checkpoint with two review scores: {score:85,weight:50}, {score:95,weight:50}
    //    Weighted average = (85*50 + 95*50) / (50+50) = 90 → letter A
    mockDb.then.mockImplementationOnce((onfulfilled) =>
      Promise.resolve([
        {
          checkpointId: 1,
          checkpointName: 'Rubric CP',
          templateCheckpointId: 1,
          order: 0,
          state: 'passed',
          gradingType: 'numeric',
          criterionId: 10,
          criterionTitle: 'Quality',
          score: 85,
          weight: 50,
          rubricLevelId: null,
          levelLabel: null,
        },
        {
          checkpointId: 1,
          checkpointName: 'Rubric CP',
          templateCheckpointId: 1,
          order: 0,
          state: 'passed',
          gradingType: 'numeric',
          criterionId: 11,
          criterionTitle: 'Clarity',
          score: 95,
          weight: 50,
          rubricLevelId: null,
          levelLabel: null,
        },
      ]).then(onfulfilled),
    );

    // 3. Upsert result
    mockDb.then.mockImplementationOnce((onfulfilled) => Promise.resolve([]).then(onfulfilled));

    await recomputeStudentGrade(mockDb as any, 1, 'student-1');

    expect(mockDb.values).toHaveBeenCalledWith(
      expect.objectContaining({
        numericScore: '90',
        letterGrade: 'A',
        status: 'complete',
      }),
    );
  });
});
