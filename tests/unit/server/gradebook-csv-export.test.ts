/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportGradebookCsvHandler } from '@/server/analytics-export.server';
import { isServerError } from '@/lib/errors';
import * as auth from '@/server/auth';
import * as dbMod from '@/db/index';

vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn(),
}));

vi.mock('@/db/index', () => ({
  getDb: vi.fn(),
}));

const adminSession = {
  user: { id: 'admin-1', name: 'Admin', role: 'admin' as const },
  session: {} as any,
};

const instructorSession = {
  user: { id: 'instructor-1', name: 'Instructor', role: 'instructor' as const },
  session: {} as any,
};

function createMockDb() {
  return {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    then: vi.fn(function (this: any, onfulfilled: any) {
      return Promise.resolve([]).then(onfulfilled);
    }),
  };
}

const defaultConfig = {
  gradingScheme: 'equal_weight' as const,
  customWeights: null,
  letterGradeBounds: { A: 90, B: 80, C: 70, D: 60 },
};

// Alice: CP1 pass/fail passed (100), CP2 rubric scores {85,50},{90,50} = 87.5
// equal_weight avg = (100 + 87.5) / 2 = 93.75 → A, complete
const aliceRows = [
  {
    studentId: 's1',
    studentName: 'Alice',
    checkpointId: 1,
    checkpointName: 'CP1',
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
    studentId: 's1',
    studentName: 'Alice',
    checkpointId: 2,
    checkpointName: 'CP2',
    templateCheckpointId: 20,
    order: 2,
    state: 'passed',
    gradingType: 'numeric',
    criterionId: 1,
    criterionTitle: 'Quality',
    score: 85,
    weight: 50,
    rubricLevelId: null,
    levelLabel: null,
  },
  {
    studentId: 's1',
    studentName: 'Alice',
    checkpointId: 2,
    checkpointName: 'CP2',
    templateCheckpointId: 20,
    order: 2,
    state: 'passed',
    gradingType: 'numeric',
    criterionId: 2,
    criterionTitle: 'Presentation',
    score: 90,
    weight: 50,
    rubricLevelId: null,
    levelLabel: null,
  },
];

// Bob: only CP1 pass/fail passed (100), no CP2
// equal_weight avg = 100 / 1 = 100 → A, complete
const bobRow = {
  studentId: 's2',
  studentName: 'Bob',
  checkpointId: 3,
  checkpointName: 'CP1',
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
};

describe('exportGradebookCsvHandler', () => {
  let mockDb: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    vi.mocked(dbMod.getDb).mockReturnValue(mockDb as any);
  });

  it('should reject if unauthorized', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);
    const result = await exportGradebookCsvHandler({ data: { assignmentId: 1 } });
    expect(isServerError(result)).toBe(true);
    if (isServerError(result)) expect(result.error.code).toBe('UNAUTHORIZED');
  });

  it('should reject if not admin', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
    const result = await exportGradebookCsvHandler({ data: { assignmentId: 1 } });
    expect(isServerError(result)).toBe(true);
    if (isServerError(result)) expect(result.error.code).toBe('UNAUTHORIZED');
  });

  it('should reject if assignment not found', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession as any);
    mockDb.then.mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled));

    const result = await exportGradebookCsvHandler({ data: { assignmentId: 999 } });
    expect(isServerError(result)).toBe(true);
    if (isServerError(result)) expect(result.error.code).toBe('NOT_FOUND');
  });

  it('should return CSV with student rows, checkpoint scores, and final grades', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession as any);

    // Query 1: assignment exists
    mockDb.then.mockImplementationOnce((onfulfilled: any) =>
      Promise.resolve([{ id: 1 }]).then(onfulfilled),
    );
    // Query 2: config
    mockDb.then.mockImplementationOnce((onfulfilled: any) =>
      Promise.resolve([defaultConfig]).then(onfulfilled),
    );
    // Query 3: checkpoint data (Alice + Bob, ordered by name)
    mockDb.then.mockImplementationOnce((onfulfilled: any) =>
      Promise.resolve([...aliceRows, bobRow]).then(onfulfilled),
    );

    const result = await exportGradebookCsvHandler({ data: { assignmentId: 1 } });
    expect(typeof result).toBe('string');
    const csv = result as string;
    const lines = csv.split('\n');

    // Headers: Student Name, CP1, CP2, Final Score, Letter Grade, Status
    expect(lines[0]).toBe('Student Name,CP1,CP2,Final Score,Letter Grade,Status');

    // Alice: CP1=100, CP2=87.5, avg=93.75, A, complete
    expect(lines[1]).toContain('Alice');
    expect(lines[1]).toContain('100');
    expect(lines[1]).toContain('87.5');
    expect(lines[1]).toContain('93.75');
    expect(lines[1]).toContain('A');
    expect(lines[1]).toContain('complete');

    // Bob: CP1=100, CP2=empty, avg=100, A, complete
    expect(lines[2]).toContain('Bob');
    expect(lines[2]).toContain('100');
    expect(lines[2]).toContain('A');
    expect(lines[2]).toContain('complete');
  });

  it('should return headers only when no student data', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession as any);

    mockDb.then
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([{ id: 1 }]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([defaultConfig]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled));

    const result = await exportGradebookCsvHandler({ data: { assignmentId: 1 } });
    expect(typeof result).toBe('string');
    const csv = result as string;
    const lines = csv.split('\n');
    // Only header line — no checkpoint columns since no data to determine them from
    expect(lines[0]).toBe('Student Name,Final Score,Letter Grade,Status');
    expect(lines).toHaveLength(1);
  });

  it('should mitigate CSV formula injection in student name', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession as any);

    mockDb.then
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([{ id: 1 }]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([defaultConfig]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([
          {
            ...aliceRows[0],
            studentName: '=HYPERLINK("http://evil.com","click")',
          },
        ]).then(onfulfilled),
      );

    const result = await exportGradebookCsvHandler({ data: { assignmentId: 1 } });
    const csv = result as string;
    // The name cell must be prefixed with a single quote to neutralize the formula
    expect(csv).toContain("'=HYPERLINK");
  });
});
