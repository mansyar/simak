/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getStudentDashboardDataHandler } from '@/server/dashboard-student.server';
import * as auth from '@/server/auth';
import * as dbMod from '@/db/index';

vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn(),
}));

vi.mock('@/db/index', () => ({
  getDb: vi.fn(),
}));

const studentSession = {
  user: { id: 'student-1', role: 'student' as const },
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

describe('getStudentDashboardDataHandler — parallel query execution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('Group A queries (activeAssignments, upcomingDeadlines, pendingReviews, consultationReminders) run concurrently', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);

    let gateResolvedCount = 0;
    const onGate = () => gateResolvedCount++;

    const now = new Date();
    const sequence: QueryResult[] = [
      {
        name: 'activeAssignments',
        result: [
          {
            id: 1,
            title: 'Thesis',
            finalDeadline: now,
            templateName: 'Default',
            templateType: 'thesis',
          },
        ],
      },
      { name: 'upcomingDeadlines', result: [] },
      { name: 'pendingReviews', result: [] },
      { name: 'consultationReminders', result: [] },
      {
        name: 'checkpoints',
        result: [{ assignmentId: 1, name: 'Ch 1', state: 'passed', dueDate: now }],
      },
    ];

    const { builder, reached } = createMockDb(sequence, [
      { indexes: [1, 2, 3, 4], resolver: onGate },
    ]);
    vi.mocked(dbMod.getDb).mockReturnValue(builder as any);

    const promise = getStudentDashboardDataHandler();
    await vi.advanceTimersByTimeAsync(0);

    expect(reached(1)).toBe(true);
    expect(reached(2)).toBe(true);
    expect(reached(3)).toBe(true);
    expect(reached(4)).toBe(true);

    await promise;
  });

  it('checkpoints-by-assignment query runs after activeAssignments resolves assignmentIds', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);

    const now = new Date();
    const sequence: QueryResult[] = [
      {
        name: 'activeAssignments',
        result: [
          {
            id: 1,
            title: 'Thesis',
            finalDeadline: now,
            templateName: 'Default',
            templateType: 'thesis',
          },
        ],
      },
      { name: 'upcomingDeadlines', result: [] },
      { name: 'pendingReviews', result: [] },
      { name: 'consultationReminders', result: [] },
      {
        name: 'checkpoints',
        result: [{ assignmentId: 1, name: 'Ch 1', state: 'passed', dueDate: now }],
      },
    ];

    const { builder } = createMockDb(sequence);
    vi.mocked(dbMod.getDb).mockReturnValue(builder as any);

    const result = (await getStudentDashboardDataHandler()) as any;
    expect(result.activeAssignments).toHaveLength(1);
    expect(result.activeAssignments[0].progressPercent).toBe(100);
  });

  it('returns identical data shape when student has no active assignments', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);

    const sequence: QueryResult[] = [
      { name: 'activeAssignments', result: [] },
      { name: 'upcomingDeadlines', result: [] },
      { name: 'pendingReviews', result: [] },
      { name: 'consultationReminders', result: [] },
    ];

    const { builder } = createMockDb(sequence);
    vi.mocked(dbMod.getDb).mockReturnValue(builder as any);

    const result = await getStudentDashboardDataHandler();
    expect(result).toEqual({
      activeAssignments: [],
      upcomingDeadlines: [],
      pendingReviews: [],
      consultationReminders: [],
      nextActions: {
        primaryActions: [],
        waitingSummary: {
          submitted: { count: 0, representatives: [] },
          underReview: { count: 0, representatives: [] },
        },
      },
    });
  });

  it('preserves sorting by effectiveDeadline and progress calculation', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);

    const now = new Date('2025-06-26T10:00:00Z');
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const dayAfterTomorrow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

    const sequence: QueryResult[] = [
      {
        name: 'activeAssignments',
        result: [
          { id: 1, title: 'A', finalDeadline: now, templateName: 'T', templateType: 'thesis' },
          { id: 2, title: 'B', finalDeadline: tomorrow, templateName: 'T', templateType: 'thesis' },
        ],
      },
      { name: 'upcomingDeadlines', result: [] },
      { name: 'pendingReviews', result: [] },
      { name: 'consultationReminders', result: [] },
      {
        name: 'checkpoints',
        result: [
          { assignmentId: 1, name: 'Ch 1', order: 1, state: 'passed', dueDate: tomorrow },
          {
            assignmentId: 1,
            name: 'Ch 2',
            order: 2,
            state: 'submitted',
            dueDate: dayAfterTomorrow,
          },
          { assignmentId: 2, name: 'Ch 1', order: 1, state: 'passed', dueDate: now },
        ],
      },
    ];

    const { builder } = createMockDb(sequence);
    vi.mocked(dbMod.getDb).mockReturnValue(builder as any);

    const result = (await getStudentDashboardDataHandler()) as any;
    expect(result.activeAssignments).toHaveLength(2);
    expect(result.activeAssignments[0].id).toBe(2); // Soonest effective deadline
    expect(result.activeAssignments[0].effectiveDeadline).toEqual(now);
    expect(result.activeAssignments[0].progressPercent).toBe(100);
    expect(result.activeAssignments[1].id).toBe(1);
    expect(result.activeAssignments[1].effectiveDeadline).toEqual(dayAfterTomorrow);
    expect(result.activeAssignments[1].progressPercent).toBe(50);
  });

  it('maps pending review and consultation data to the expected shape', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);

    const submittedAt = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const consultationDate = new Date('2025-06-24T10:00:00Z');
    const now = new Date();

    const sequence: QueryResult[] = [
      { name: 'activeAssignments', result: [] },
      {
        name: 'upcomingDeadlines',
        result: [
          {
            assignmentId: 1,
            checkpointId: 10,
            assignmentTitle: 'Thesis',
            checkpointName: 'Ch 1',
            dueDate: now,
            state: 'submitted',
          },
        ],
      },
      {
        name: 'pendingReviews',
        result: [
          {
            submissionId: 100,
            assignmentId: 1,
            checkpointId: 10,
            assignmentTitle: 'Thesis',
            checkpointName: 'Ch 1',
            submittedAt,
          },
        ],
      },
      {
        name: 'consultationReminders',
        result: [
          {
            assignmentId: 1,
            checkpointId: 10,
            assignmentTitle: 'Thesis',
            checkpointName: 'Ch 1',
            consultationDate,
            consultationId: 50,
          },
        ],
      },
    ];

    const { builder } = createMockDb(sequence);
    vi.mocked(dbMod.getDb).mockReturnValue(builder as any);

    const result = (await getStudentDashboardDataHandler()) as any;
    expect(result.upcomingDeadlines).toHaveLength(1);
    expect(result.upcomingDeadlines[0].assignmentTitle).toBe('Thesis');
    expect(result.upcomingDeadlines[0].checkpointId).toBe(10);
    expect(result.pendingReviews).toHaveLength(1);
    expect(result.pendingReviews[0].assignmentId).toBe(1);
    expect(result.pendingReviews[0].checkpointId).toBe(10);
    expect(result.pendingReviews[0].waitTimeDays).toBeGreaterThanOrEqual(0);
    expect(result.consultationReminders).toHaveLength(1);
    expect(result.consultationReminders[0].assignmentId).toBe(1);
    expect(result.consultationReminders[0].checkpointId).toBe(10);
    expect(result.consultationReminders[0].consultationId).toBe(50);
  });
});
