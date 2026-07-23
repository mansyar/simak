/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportRubricScoresCsvHandler } from '@/server/analytics-export.server';
import { isServerError } from '@/lib/errors';
import * as auth from '@/server/auth';
import * as dbMod from '@/db/index';

vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn(),
}));

vi.mock('@/db/index', () => ({
  getDb: vi.fn(),
}));

const instructorSession = {
  user: { id: 'instructor-1', name: 'Instructor', role: 'instructor' as const },
  session: {} as any,
};

const studentSession = {
  user: { id: 'student-1', name: 'Student', role: 'student' as const },
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
    then: vi.fn(function (this: any, onfulfilled: any) {
      return Promise.resolve([]).then(onfulfilled);
    }),
  };
}

describe('exportRubricScoresCsvHandler', () => {
  let mockDb: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    vi.mocked(dbMod.getDb).mockReturnValue(mockDb as any);
  });

  it('should reject if unauthorized', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);
    const result = await exportRubricScoresCsvHandler({ data: { assignmentId: 1 } });
    expect(isServerError(result)).toBe(true);
    if (isServerError(result)) expect(result.error.code).toBe('UNAUTHORIZED');
  });

  it('should reject if not instructor', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);
    const result = await exportRubricScoresCsvHandler({ data: { assignmentId: 1 } });
    expect(isServerError(result)).toBe(true);
    if (isServerError(result)) expect(result.error.code).toBe('UNAUTHORIZED');
  });

  it('should reject if assignment does not belong to instructor', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
    mockDb.then.mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled));

    const result = await exportRubricScoresCsvHandler({ data: { assignmentId: 999 } });
    expect(isServerError(result)).toBe(true);
    if (isServerError(result)) expect(result.error.code).toBe('NOT_FOUND');
  });

  it('should return CSV string with rubric score headers and rows', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
    mockDb.then
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([{ id: 1 }]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([
          {
            studentName: 'John Doe',
            checkpointName: 'Proposal Review',
            criterionTitle: 'Technical Quality',
            score: 85,
            weight: 50,
            levelLabel: null,
            comment: 'Good technical implementation',
          },
          {
            studentName: 'John Doe',
            checkpointName: 'Proposal Review',
            criterionTitle: 'Presentation',
            score: 90,
            weight: 50,
            levelLabel: 'Excellent',
            comment: 'Clear presentation',
          },
        ]).then(onfulfilled),
      );

    const result = await exportRubricScoresCsvHandler({ data: { assignmentId: 1 } });
    expect(typeof result).toBe('string');
    const csv = result as string;
    const lines = csv.split('\n');
    expect(lines[0]).toBe('Student,Checkpoint,Criterion,Score,Weight,Level,Comment');
    expect(lines[1]).toContain('John Doe');
    expect(lines[1]).toContain('Proposal Review');
    expect(lines[1]).toContain('Technical Quality');
    expect(lines[1]).toContain('85');
    expect(lines[1]).toContain('50');
    expect(lines[2]).toContain('Excellent');
    expect(lines[2]).toContain('90');
  });

  it('should return headers only when no rubric scores', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
    mockDb.then
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([{ id: 1 }]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled));

    const result = await exportRubricScoresCsvHandler({ data: { assignmentId: 1 } });
    expect(typeof result).toBe('string');
    const csv = result as string;
    const lines = csv.split('\n');
    expect(lines[0]).toBe('Student,Checkpoint,Criterion,Score,Weight,Level,Comment');
    expect(lines).toHaveLength(1);
  });

  it('should mitigate CSV formula injection in comment field', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
    mockDb.then
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([{ id: 1 }]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([
          {
            studentName: 'John Doe',
            checkpointName: 'Review 1',
            criterionTitle: 'Quality',
            score: 80,
            weight: 100,
            levelLabel: null,
            comment: '=HYPERLINK("http://evil.com","click")',
          },
        ]).then(onfulfilled),
      );

    const result = await exportRubricScoresCsvHandler({ data: { assignmentId: 1 } });
    const csv = result as string;
    expect(csv).toContain("'=HYPERLINK");
  });
});
