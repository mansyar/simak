/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getAdminDashboardDataHandler } from '@/server/dashboard.server';
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

const adminSession = {
  user: { id: 'admin-1', role: 'admin' as const },
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

describe('getAdminDashboardDataHandler — parallel query execution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('All 7 independent queries run concurrently via a single Promise.all', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession as any);

    let gateResolvedCount = 0;
    const onGate = () => gateResolvedCount++;

    const sequence: QueryResult[] = [
      { name: 'userCounts', result: [{ total: 10, instructors: 2, students: 5 }] },
      { name: 'activeAssignmentCount', result: [{ activeAssignmentCount: 3 }] },
      { name: 'pendingReviewCount', result: [{ pendingReviewCount: 7 }] },
      { name: 'activeConsultationCount', result: [{ activeConsultationCount: 4 }] },
      { name: 'recentActivity', result: [] },
      { name: 'emailCounts', result: [{ pending: 5, sent: 10, failed: 2 }] },
      { name: 'escalationAlerts', result: [] },
    ];

    const { builder, reached } = createMockDb(sequence, [
      { indexes: [1, 2, 3, 4, 5, 6, 7], resolver: onGate },
    ]);
    vi.mocked(dbMod.getDb).mockReturnValue(builder as any);

    const promise = getAdminDashboardDataHandler();
    await vi.advanceTimersByTimeAsync(0);

    for (let i = 1; i <= 7; i++) {
      expect(reached(i)).toBe(true);
    }

    const result = (await promise) as any;
    expect(result.metrics).toEqual({
      totalUsers: 10,
      instructors: 2,
      students: 5,
      activeAssignments: 3,
      pendingReviews: 7,
      activeConsultations: 4,
    });
  });

  it('Returned data shape matches the sequential version', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession as any);

    const now = new Date();
    const sequence: QueryResult[] = [
      { name: 'userCounts', result: [{ total: 10, instructors: 2, students: 5 }] },
      { name: 'activeAssignmentCount', result: [{ activeAssignmentCount: 3 }] },
      { name: 'pendingReviewCount', result: [{ pendingReviewCount: 7 }] },
      { name: 'activeConsultationCount', result: [{ activeConsultationCount: 4 }] },
      {
        name: 'recentActivity',
        result: [
          {
            id: 1,
            type: 'sla_breach',
            titleKey: 'SLA Breach',
            messageKey: 'Overdue',
            params: null,
            createdAt: now,
          },
        ],
      },
      { name: 'emailCounts', result: [{ pending: 12, sent: 45, failed: 3 }] },
      {
        name: 'escalationAlerts',
        result: [
          {
            submissionId: 10,
            instructorName: 'Dr. Smith',
            assignmentTitle: 'Thesis',
            checkpointName: 'Ch 1',
            studentName: 'Alice',
            daysOverdue: 5,
          },
        ],
      },
    ];

    const { builder } = createMockDb(sequence);
    vi.mocked(dbMod.getDb).mockReturnValue(builder as any);

    const result = (await getAdminDashboardDataHandler()) as any;
    expect(result.metrics).toEqual({
      totalUsers: 10,
      instructors: 2,
      students: 5,
      activeAssignments: 3,
      pendingReviews: 7,
      activeConsultations: 4,
    });
    expect(result.emailQueueCounts).toEqual({ pending: 12, sent: 45, failed: 3 });
    expect(result.recentActivity).toHaveLength(1);
    expect(result.recentActivity[0].title).toBe('SLA Breach');
    expect(result.escalationAlerts).toHaveLength(1);
    expect(result.escalationAlerts[0].daysOverdue).toBe(5);
  });

  it('Escalation alerts ordering is preserved (daysOverdue DESC)', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession as any);

    const sequence: QueryResult[] = [
      { name: 'userCounts', result: [{ total: 1, instructors: 0, students: 0 }] },
      { name: 'activeAssignmentCount', result: [{ activeAssignmentCount: 0 }] },
      { name: 'pendingReviewCount', result: [{ pendingReviewCount: 0 }] },
      { name: 'activeConsultationCount', result: [{ activeConsultationCount: 0 }] },
      { name: 'recentActivity', result: [] },
      { name: 'emailCounts', result: [{ pending: 0, sent: 0, failed: 0 }] },
      {
        name: 'escalationAlerts',
        result: [
          {
            submissionId: 10,
            instructorName: 'A',
            assignmentTitle: 'T',
            checkpointName: 'C1',
            studentName: 'S1',
            daysOverdue: 5,
          },
          {
            submissionId: 11,
            instructorName: 'B',
            assignmentTitle: 'T',
            checkpointName: 'C2',
            studentName: 'S2',
            daysOverdue: 3,
          },
        ],
      },
    ];

    const { builder } = createMockDb(sequence);
    vi.mocked(dbMod.getDb).mockReturnValue(builder as any);

    const result = (await getAdminDashboardDataHandler()) as any;
    expect(result.escalationAlerts).toHaveLength(2);
    expect(result.escalationAlerts[0].daysOverdue).toBe(5);
    expect(result.escalationAlerts[1].daysOverdue).toBe(3);
  });

  it('Handles empty result sets for metrics without throwing', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession as any);

    const sequence: QueryResult[] = [
      { name: 'userCounts', result: [{ total: 0, instructors: 0, students: 0 }] },
      { name: 'activeAssignmentCount', result: [{ activeAssignmentCount: 0 }] },
      { name: 'pendingReviewCount', result: [{ pendingReviewCount: 0 }] },
      { name: 'activeConsultationCount', result: [{ activeConsultationCount: 0 }] },
      { name: 'recentActivity', result: [] },
      { name: 'emailCounts', result: [{ pending: 0, sent: 0, failed: 0 }] },
      { name: 'escalationAlerts', result: [] },
    ];

    const { builder } = createMockDb(sequence);
    vi.mocked(dbMod.getDb).mockReturnValue(builder as any);

    const result = (await getAdminDashboardDataHandler()) as any;
    expect(result.metrics).toEqual({
      totalUsers: 0,
      instructors: 0,
      students: 0,
      activeAssignments: 0,
      pendingReviews: 0,
      activeConsultations: 0,
    });
    expect(result.recentActivity).toEqual([]);
    expect(result.escalationAlerts).toEqual([]);
  });
});
