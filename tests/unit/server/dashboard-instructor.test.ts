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

const studentSession = {
  user: { id: 'student-1', role: 'student' as const },
  session: {} as any,
};

describe('getInstructorDashboardDataHandler', () => {
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

  it('should reject if unauthorized (no session)', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);
    const result = await getInstructorDashboardDataHandler();
    expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
  });

  it('should reject if not an instructor', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);
    const result = await getInstructorDashboardDataHandler();
    expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
  });

  it('should return empty dashboard when instructor has no assignments', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
    // Query 1: instructorAssignments → []
    // Query 4: recentSubmissions → []
    // Query 5: assignmentOverview → []
    mockDb.then
      .mockImplementationOnce((fn: any) => Promise.resolve([]).then(fn))
      .mockImplementationOnce((fn: any) => Promise.resolve([]).then(fn))
      .mockImplementationOnce((fn: any) => Promise.resolve([]).then(fn));

    const result = await getInstructorDashboardDataHandler();
    expect(result).toEqual({
      pendingReviewCount: 0,
      pendingReviewItems: [],
      recentSubmissions: [],
      assignments: [],
    });
  });

  it('should return pending review items with assignment data', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
    const submittedAt = new Date('2025-06-20T10:00:00Z');

    mockDb.then
      // Query 1: instructorAssignments
      .mockImplementationOnce((fn: any) => Promise.resolve([{ id: 1 }]).then(fn))
      // Query 2: pendingReviewCount
      .mockImplementationOnce((fn: any) => Promise.resolve([{ count: 2 }]).then(fn))
      // Query 3: pendingReviewItems
      .mockImplementationOnce((fn: any) =>
        Promise.resolve([
          {
            submissionId: 100,
            checkpointId: 10,
            checkpointName: 'Chapter 1',
            assignmentTitle: 'Thesis Draft',
            studentName: 'Alice',
            submittedAt,
          },
        ]).then(fn),
      )
      // Query 4: recentSubmissions
      .mockImplementationOnce((fn: any) => Promise.resolve([]).then(fn))
      // Query 5: assignmentOverview
      .mockImplementationOnce((fn: any) =>
        Promise.resolve([
          { id: 1, title: 'Thesis Draft', finalDeadline: null, createdAt: new Date() },
        ]).then(fn),
      )
      // Query 6: studentCounts
      .mockImplementationOnce((fn: any) =>
        Promise.resolve([{ assignmentId: 1, count: 3 }]).then(fn),
      )
      // Query 7: pendingCounts
      .mockImplementationOnce((fn: any) =>
        Promise.resolve([{ assignmentId: 1, count: 2 }]).then(fn),
      )
      // Query 8: progressData
      .mockImplementationOnce((fn: any) =>
        Promise.resolve([{ assignmentId: 1, totalCount: 10, passedCount: 5 }]).then(fn),
      );

    const result = (await getInstructorDashboardDataHandler()) as any;
    expect(result.pendingReviewCount).toBe(2);
    expect(result.pendingReviewItems).toHaveLength(1);
    expect(result.pendingReviewItems[0].checkpointName).toBe('Chapter 1');
    expect(result.pendingReviewItems[0].studentName).toBe('Alice');
    expect(result.assignments).toHaveLength(1);
    expect(result.assignments[0].studentCount).toBe(3);
    expect(result.assignments[0].pendingReviewCount).toBe(2);
    expect(result.assignments[0].overallProgressPercent).toBe(50);
  });

  it('should deduplicate pending review items by checkpointId', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
    const now = new Date();

    mockDb.then
      .mockImplementationOnce((fn: any) => Promise.resolve([{ id: 1 }]).then(fn))
      .mockImplementationOnce((fn: any) => Promise.resolve([{ count: 3 }]).then(fn))
      // Two submissions for the same checkpoint (checkpointId: 10)
      .mockImplementationOnce((fn: any) =>
        Promise.resolve([
          {
            submissionId: 100,
            checkpointId: 10,
            checkpointName: 'Ch 1',
            assignmentTitle: 'Thesis',
            studentName: 'Alice',
            submittedAt: now,
          },
          {
            submissionId: 101,
            checkpointId: 10,
            checkpointName: 'Ch 1',
            assignmentTitle: 'Thesis',
            studentName: 'Alice',
            submittedAt: now,
          },
          {
            submissionId: 102,
            checkpointId: 11,
            checkpointName: 'Ch 2',
            assignmentTitle: 'Thesis',
            studentName: 'Bob',
            submittedAt: now,
          },
        ]).then(fn),
      )
      .mockImplementationOnce((fn: any) => Promise.resolve([]).then(fn))
      .mockImplementationOnce((fn: any) =>
        Promise.resolve([
          { id: 1, title: 'Thesis', finalDeadline: null, createdAt: new Date() },
        ]).then(fn),
      )
      .mockImplementationOnce((fn: any) =>
        Promise.resolve([{ assignmentId: 1, count: 2 }]).then(fn),
      )
      .mockImplementationOnce((fn: any) =>
        Promise.resolve([{ assignmentId: 1, count: 1 }]).then(fn),
      )
      .mockImplementationOnce((fn: any) =>
        Promise.resolve([{ assignmentId: 1, totalCount: 5, passedCount: 2 }]).then(fn),
      );

    const result = (await getInstructorDashboardDataHandler()) as any;
    expect(result.pendingReviewItems).toHaveLength(2);
  });

  it('should handle null submittedAt in pending review items', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);

    mockDb.then
      .mockImplementationOnce((fn: any) => Promise.resolve([{ id: 1 }]).then(fn))
      .mockImplementationOnce((fn: any) => Promise.resolve([{ count: 1 }]).then(fn))
      .mockImplementationOnce((fn: any) =>
        Promise.resolve([
          {
            submissionId: 100,
            checkpointId: 10,
            checkpointName: 'Ch 1',
            assignmentTitle: 'Thesis',
            studentName: 'Alice',
            submittedAt: null,
          },
        ]).then(fn),
      )
      .mockImplementationOnce((fn: any) => Promise.resolve([]).then(fn))
      .mockImplementationOnce((fn: any) =>
        Promise.resolve([
          { id: 1, title: 'Thesis', finalDeadline: null, createdAt: new Date() },
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

    const result = (await getInstructorDashboardDataHandler()) as any;
    expect(result.pendingReviewItems[0].submittedAt).toBeNull();
    // waitTimeDays should be 0 when submittedAt is null (fallback to Date.now())
    expect(result.pendingReviewItems[0].waitTimeDays).toBe(0);
  });

  it('should map checkpoint states to status labels', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
    const now = new Date();

    mockDb.then
      .mockImplementationOnce((fn: any) => Promise.resolve([{ id: 1 }]).then(fn))
      // count query (destructured as [{ count }])
      .mockImplementationOnce((fn: any) => Promise.resolve([{ count: 0 }]).then(fn))
      // pending review items (empty)
      .mockImplementationOnce((fn: any) => Promise.resolve([]).then(fn))
      // Recent submissions with all 4 status types
      .mockImplementationOnce((fn: any) =>
        Promise.resolve([
          {
            submissionId: 1,
            studentName: 'A',
            assignmentTitle: 'T',
            checkpointName: 'C1',
            submittedAt: now,
            checkpointState: 'submitted',
          },
          {
            submissionId: 2,
            studentName: 'B',
            assignmentTitle: 'T',
            checkpointName: 'C2',
            submittedAt: now,
            checkpointState: 'under_review',
          },
          {
            submissionId: 3,
            studentName: 'C',
            assignmentTitle: 'T',
            checkpointName: 'C3',
            submittedAt: now,
            checkpointState: 'passed',
          },
          {
            submissionId: 4,
            studentName: 'D',
            assignmentTitle: 'T',
            checkpointName: 'C4',
            submittedAt: now,
            checkpointState: 'revised',
          },
        ]).then(fn),
      )
      .mockImplementationOnce((fn: any) =>
        Promise.resolve([{ id: 1, title: 'T', finalDeadline: null, createdAt: new Date() }]).then(
          fn,
        ),
      )
      .mockImplementationOnce((fn: any) => Promise.resolve([]).then(fn))
      .mockImplementationOnce((fn: any) => Promise.resolve([]).then(fn))
      .mockImplementationOnce((fn: any) => Promise.resolve([]).then(fn));

    const result = (await getInstructorDashboardDataHandler()) as any;
    expect(result.recentSubmissions[0].status).toBe('Submitted');
    expect(result.recentSubmissions[1].status).toBe('Under Review');
    expect(result.recentSubmissions[2].status).toBe('Pass');
    expect(result.recentSubmissions[3].status).toBe('Revise');
  });

  it('should default to 0 for missing map entries in assignment details', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);

    mockDb.then
      .mockImplementationOnce((fn: any) => Promise.resolve([{ id: 1 }]).then(fn))
      .mockImplementationOnce((fn: any) => Promise.resolve([{ count: 0 }]).then(fn))
      .mockImplementationOnce((fn: any) => Promise.resolve([]).then(fn))
      .mockImplementationOnce((fn: any) => Promise.resolve([]).then(fn))
      .mockImplementationOnce((fn: any) =>
        Promise.resolve([
          { id: 1, title: 'Thesis', finalDeadline: null, createdAt: new Date() },
        ]).then(fn),
      )
      // All maps return empty (no matching entries)
      .mockImplementationOnce((fn: any) => Promise.resolve([]).then(fn))
      .mockImplementationOnce((fn: any) => Promise.resolve([]).then(fn))
      .mockImplementationOnce((fn: any) => Promise.resolve([]).then(fn));

    const result = (await getInstructorDashboardDataHandler()) as any;
    expect(result.assignments[0].studentCount).toBe(0);
    expect(result.assignments[0].pendingReviewCount).toBe(0);
    expect(result.assignments[0].overallProgressPercent).toBe(0);
  });

  it('should calculate 0% progress when totalCount is 0', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);

    mockDb.then
      .mockImplementationOnce((fn: any) => Promise.resolve([{ id: 1 }]).then(fn))
      .mockImplementationOnce((fn: any) => Promise.resolve([{ count: 0 }]).then(fn))
      .mockImplementationOnce((fn: any) => Promise.resolve([]).then(fn))
      .mockImplementationOnce((fn: any) => Promise.resolve([]).then(fn))
      .mockImplementationOnce((fn: any) =>
        Promise.resolve([
          { id: 1, title: 'Thesis', finalDeadline: null, createdAt: new Date() },
        ]).then(fn),
      )
      .mockImplementationOnce((fn: any) => Promise.resolve([]).then(fn))
      .mockImplementationOnce((fn: any) => Promise.resolve([]).then(fn))
      .mockImplementationOnce((fn: any) =>
        Promise.resolve([{ assignmentId: 1, totalCount: 0, passedCount: 0 }]).then(fn),
      );

    const result = (await getInstructorDashboardDataHandler()) as any;
    expect(result.assignments[0].overallProgressPercent).toBe(0);
  });

  it('should return Internal Server Error on database failure', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
    mockDb.then.mockImplementationOnce(() => {
      throw new Error('DB connection lost');
    });

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await getInstructorDashboardDataHandler();
    expect(result).toEqual({ error: { code: 'INTERNAL', message: 'Internal Server Error' } });
    consoleSpy.mockRestore();
  });
});
