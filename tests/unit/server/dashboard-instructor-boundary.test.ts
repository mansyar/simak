/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getInstructorDashboardDataHandler } from '@/server/dashboard-instructor.server';
import * as auth from '@/server/auth';
import * as dbMod from '@/db/index';

vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn(),
}));

vi.mock('@/db/index', () => ({
  getDb: vi.fn(),
}));

const instructorSession = {
  user: { id: 'instructor-1', role: 'instructor' as const },
  session: {} as any,
};

describe('getInstructorDashboardDataHandler — boundary date serialization', () => {
  let mockDb: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      then: vi.fn(function (onfulfilled: any) {
        return Promise.resolve([]).then(onfulfilled);
      }),
    };
    vi.mocked(dbMod.getDb).mockReturnValue(mockDb as any);
  });

  it('returns ISO strings for date fields crossing the boundary', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);

    const assignmentDeadline = new Date('2026-12-31T00:00:00.000Z');
    const assignmentCreatedAt = new Date('2026-05-01T10:30:00.000Z');
    const pendingSubmittedAt = new Date('2026-06-15T14:00:00.000Z');
    const recentSubmittedAt = new Date('2026-06-20T09:00:00.000Z');

    mockDb.then
      .mockImplementationOnce((fn: any) => Promise.resolve([{ id: 1 }]).then(fn))
      .mockImplementationOnce((fn: any) =>
        Promise.resolve([
          {
            submissionId: 1,
            studentName: 'A',
            assignmentTitle: 'T',
            checkpointName: 'C1',
            submittedAt: recentSubmittedAt,
            checkpointState: 'submitted',
          },
        ]).then(fn),
      )
      .mockImplementationOnce((fn: any) =>
        Promise.resolve([
          {
            id: 1,
            title: 'Thesis',
            finalDeadline: assignmentDeadline,
            createdAt: assignmentCreatedAt,
          },
        ]).then(fn),
      )
      .mockImplementationOnce((fn: any) => Promise.resolve([{ count: 1 }]).then(fn))
      .mockImplementationOnce((fn: any) =>
        Promise.resolve([
          {
            submissionId: 100,
            checkpointId: 10,
            checkpointName: 'Chapter 1',
            assignmentTitle: 'Thesis',
            studentName: 'Alice',
            submittedAt: pendingSubmittedAt,
          },
        ]).then(fn),
      )
      .mockImplementationOnce((fn: any) =>
        Promise.resolve([{ assignmentId: 1, count: 1 }]).then(fn),
      )
      .mockImplementationOnce((fn: any) =>
        Promise.resolve([{ assignmentId: 1, count: 1 }]).then(fn),
      )
      .mockImplementationOnce((fn: any) =>
        Promise.resolve([{ assignmentId: 1, totalCount: 2, passedCount: 1 }]).then(fn),
      );

    const result = await getInstructorDashboardDataHandler();

    expect(result).not.toHaveProperty('error');
    const data = result as Exclude<typeof result, { error: unknown }>;

    expect(data.assignments[0].finalDeadline).toBe(assignmentDeadline.toISOString());
    expect(data.assignments[0].createdAt).toBe(assignmentCreatedAt.toISOString());
    expect(data.pendingReviewItems[0].submittedAt).toBe(pendingSubmittedAt.toISOString());
    expect(data.recentSubmissions[0].submittedAt).toBe(recentSubmittedAt.toISOString());
  });

  it('preserves null for missing submittedAt in pending review items', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);

    mockDb.then
      .mockImplementationOnce((fn: any) => Promise.resolve([{ id: 1 }]).then(fn))
      .mockImplementationOnce((fn: any) => Promise.resolve([]).then(fn))
      .mockImplementationOnce((fn: any) =>
        Promise.resolve([{ id: 1, title: 'Thesis', finalDeadline: null, createdAt: null }]).then(
          fn,
        ),
      )
      .mockImplementationOnce((fn: any) => Promise.resolve([{ count: 1 }]).then(fn))
      .mockImplementationOnce((fn: any) =>
        Promise.resolve([
          {
            submissionId: 100,
            checkpointId: 10,
            checkpointName: 'Chapter 1',
            assignmentTitle: 'Thesis',
            studentName: 'Alice',
            submittedAt: null,
          },
        ]).then(fn),
      )
      .mockImplementationOnce((fn: any) =>
        Promise.resolve([{ assignmentId: 1, count: 1 }]).then(fn),
      )
      .mockImplementationOnce((fn: any) =>
        Promise.resolve([{ assignmentId: 1, count: 1 }]).then(fn),
      )
      .mockImplementationOnce((fn: any) =>
        Promise.resolve([{ assignmentId: 1, totalCount: 1, passedCount: 0 }]).then(fn),
      );

    const result = await getInstructorDashboardDataHandler();

    expect(result).not.toHaveProperty('error');
    const data = result as Exclude<typeof result, { error: unknown }>;

    expect(data.assignments[0].finalDeadline).toBeNull();
    expect(data.assignments[0].createdAt).toBeNull();
    expect(data.pendingReviewItems[0].submittedAt).toBeNull();
  });
});
