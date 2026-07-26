/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAdminAnalyticsDataHandler } from '@/server/analytics-admin.server';
import * as auth from '@/server/auth';
import * as dbMod from '@/db/index';

vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn(),
}));

vi.mock('@/db/index', () => ({
  getDb: vi.fn(),
}));

const adminSession = {
  user: { id: 'admin-1', role: 'admin' as const },
  session: {} as any,
};

describe('getAdminAnalyticsDataHandler - grade distribution', () => {
  let mockDb: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      then: vi.fn(function (onfulfilled: any) {
        return Promise.resolve([]).then(onfulfilled);
      }),
    };
    vi.mocked(dbMod.getDb).mockReturnValue(mockDb as any);
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession as any);
  });

  /** Set up 9 query results for Promise.all, in order:
   * 0: consultation stats, 1: deadline stats, 2: status distribution,
   * 3: submission trend, 4: review trend, 5: reviews count,
   * 6: DAU trend, 7: WAU trend, 8: grade distribution */
  function mockResults(results: any[][]) {
    results.forEach((result) => {
      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve(result).then(onfulfilled),
      );
    });
  }

  const emptyResults = [
    [{ total: 0, verified: 0 }],
    [{ total: 0, breached: 0 }],
    [],
    [],
    [],
    [{ count: 0 }],
    [],
    [],
    [],
  ];

  it('should return gradeDistribution with correct counts when data exists', async () => {
    mockResults([
      [{ total: 0, verified: 0 }],
      [{ total: 0, breached: 0 }],
      [],
      [],
      [],
      [{ count: 0 }],
      [],
      [],
      [
        { letterGrade: 'A', count: 5 },
        { letterGrade: 'B', count: 3 },
        { letterGrade: 'C', count: 2 },
        { letterGrade: 'D', count: 1 },
        { letterGrade: 'F', count: 1 },
      ],
    ]);
    const result = (await getAdminAnalyticsDataHandler({ data: { range: '30d' } })) as any;
    expect(result.gradeDistribution).toEqual({ A: 5, B: 3, C: 2, D: 1, F: 1 });
  });

  it('should default gradeDistribution to all zeros when no data', async () => {
    mockResults(emptyResults);
    const result = (await getAdminAnalyticsDataHandler({ data: { range: '30d' } })) as any;
    expect(result.gradeDistribution).toEqual({ A: 0, B: 0, C: 0, D: 0, F: 0 });
  });

  it('should include all 5 letter grade keys in gradeDistribution', async () => {
    mockResults([...emptyResults.slice(0, 8), [{ letterGrade: 'A', count: 10 }]]);
    const result = (await getAdminAnalyticsDataHandler({ data: { range: '30d' } })) as any;
    expect(result.gradeDistribution).toHaveProperty('A', 10);
    expect(result.gradeDistribution).toHaveProperty('B', 0);
    expect(result.gradeDistribution).toHaveProperty('C', 0);
    expect(result.gradeDistribution).toHaveProperty('D', 0);
    expect(result.gradeDistribution).toHaveProperty('F', 0);
  });
});
