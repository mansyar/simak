/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

type QueryResult = { name: string; result: any };

function createMockDb(
  sequence: QueryResult[],
  gateIndexes?: { indexes: number[]; resolver: () => void }[],
) {
  let thenCallCount = 0;
  const gateMap = new Map<number, () => void>();
  const resolverCount = new Map<number, number>();

  for (const gate of gateIndexes ?? []) {
    for (const idx of gate.indexes) {
      gateMap.set(idx, () => {
        resolverCount.set(idx, 1);
        gate.resolver();
      });
    }
  }

  const builder: any = {
    select: vi.fn(() => builder),
    from: vi.fn(() => builder),
    where: vi.fn(() => builder),
    orderBy: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    innerJoin: vi.fn(() => builder),
    groupBy: vi.fn(() => builder),
    then: vi.fn((onFulfilled: any) => {
      thenCallCount++;

      const gateResolver = gateMap.get(thenCallCount);
      if (gateResolver) {
        gateResolver();
      }

      const item = sequence.shift();
      return Promise.resolve(item?.result ?? []).then(onFulfilled);
    }),
  };

  return { builder, reached: (idx: number) => resolverCount.has(idx) };
}

describe('getInstructorDashboardDataHandler — parallel query execution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('Group A queries (instructorAssignments, recentSubmissions, assignmentOverview) run concurrently', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);

    let gateResolvedCount = 0;
    const onGate = () => gateResolvedCount++;

    const sequence: QueryResult[] = [
      { name: 'instructorAssignments', result: [{ id: 1 }] },
      { name: 'recentSubmissions', result: [] },
      { name: 'assignmentOverview', result: [] },
      { name: 'pendingReviewCount', result: [{ count: 0 }] },
      { name: 'pendingReviewItems', result: [] },
      { name: 'studentCount', result: [] },
      { name: 'pendingAssignmentCount', result: [] },
      { name: 'progressData', result: [] },
    ];

    const { builder, reached } = createMockDb(sequence, [{ indexes: [1, 2, 3], resolver: onGate }]);
    vi.mocked(dbMod.getDb).mockReturnValue(builder as any);

    const promise = getInstructorDashboardDataHandler();
    await vi.advanceTimersByTimeAsync(0);

    expect(reached(1)).toBe(true);
    expect(reached(2)).toBe(true);
    expect(reached(3)).toBe(true);

    await promise;
  });

  it('Group B queries (pendingReviewCount, pendingReviewItems) run concurrently after assignmentIds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);

    let gateResolvedCount = 0;
    const onGate = () => gateResolvedCount++;

    const submittedAt = new Date('2025-06-20T10:00:00Z');
    const sequence: QueryResult[] = [
      { name: 'instructorAssignments', result: [{ id: 1 }] },
      { name: 'recentSubmissions', result: [] },
      { name: 'assignmentOverview', result: [] },
      { name: 'pendingReviewCount', result: [{ count: 1 }] },
      {
        name: 'pendingReviewItems',
        result: [
          {
            submissionId: 100,
            checkpointId: 10,
            checkpointName: 'Ch 1',
            assignmentTitle: 'Thesis',
            studentName: 'Alice',
            submittedAt,
          },
        ],
      },
      { name: 'studentCount', result: [] },
      { name: 'pendingAssignmentCount', result: [] },
      { name: 'progressData', result: [] },
    ];

    const { builder, reached } = createMockDb(sequence, [{ indexes: [4, 5], resolver: onGate }]);
    vi.mocked(dbMod.getDb).mockReturnValue(builder as any);

    const promise = getInstructorDashboardDataHandler();
    await vi.advanceTimersByTimeAsync(0);

    expect(reached(4)).toBe(true);
    expect(reached(5)).toBe(true);

    const result = (await promise) as any;
    expect(result.pendingReviewCount).toBe(1);
    expect(result.pendingReviewItems).toHaveLength(1);
  });

  it('Group C queries (studentCount, pendingReviewCount, progressData) run concurrently after overviewIds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);

    let gateResolvedCount = 0;
    const onGate = () => gateResolvedCount++;

    const sequence: QueryResult[] = [
      { name: 'instructorAssignments', result: [{ id: 1 }] },
      { name: 'recentSubmissions', result: [] },
      {
        name: 'assignmentOverview',
        result: [{ id: 1, title: 'Thesis', finalDeadline: null, createdAt: new Date() }],
      },
      { name: 'pendingReviewCount', result: [{ count: 0 }] },
      { name: 'pendingReviewItems', result: [] },
      { name: 'studentCount', result: [{ assignmentId: 1, count: 3 }] },
      { name: 'pendingAssignmentCount', result: [{ assignmentId: 1, count: 2 }] },
      { name: 'progressData', result: [{ assignmentId: 1, totalCount: 10, passedCount: 5 }] },
    ];

    const { builder, reached } = createMockDb(sequence, [{ indexes: [6, 7, 8], resolver: onGate }]);
    vi.mocked(dbMod.getDb).mockReturnValue(builder as any);

    const promise = getInstructorDashboardDataHandler();
    await vi.advanceTimersByTimeAsync(0);

    expect(reached(6)).toBe(true);
    expect(reached(7)).toBe(true);
    expect(reached(8)).toBe(true);

    const result = (await promise) as any;
    expect(result.assignments[0].studentCount).toBe(3);
    expect(result.assignments[0].pendingReviewCount).toBe(2);
    expect(result.assignments[0].overallProgressPercent).toBe(50);
  });

  it('returns identical data shape when instructor has no assignments', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);

    const sequence: QueryResult[] = [
      { name: 'instructorAssignments', result: [] },
      { name: 'recentSubmissions', result: [] },
      { name: 'assignmentOverview', result: [] },
    ];

    const { builder } = createMockDb(sequence);
    vi.mocked(dbMod.getDb).mockReturnValue(builder as any);

    const result = await getInstructorDashboardDataHandler();
    expect(result).toEqual({
      pendingReviewCount: 0,
      pendingReviewItems: [],
      recentSubmissions: [],
      assignments: [],
      atRiskStudents: [],
    });
  });
});
