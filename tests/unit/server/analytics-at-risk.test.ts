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

describe('getAdminAnalyticsDataHandler - at-risk summary', () => {
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

  /** Queue 9 query results for Promise.all (8) + at-risk summary (9th).
   * 0: consultation stats, 1: deadline stats, 2: status distribution,
   * 3: submission trend, 4: review trend, 5: reviews count,
   * 6: DAU trend, 7: WAU trend, 8: at-risk summary */
  function mockResults(results: any[][]) {
    results.forEach((result) => {
      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve(result).then(onfulfilled),
      );
    });
  }

  const emptyStandard = [
    [{ total: 0, verified: 0 }],
    [{ total: 0, breached: 0 }],
    [],
    [],
    [],
    [{ count: 0 }],
    [],
    [],
  ];

  it('should return atRiskSummary with high, medium, and low counts', async () => {
    mockResults([...emptyStandard, [{ high: 5, medium: 3, low: 7 }]]);
    const result = (await getAdminAnalyticsDataHandler({ data: { range: '30d' } })) as any;
    expect(result.atRiskSummary).toEqual({ high: 5, medium: 3, low: 7 });
  });

  it('should return zero counts when no at-risk students', async () => {
    mockResults([...emptyStandard, [{ high: 0, medium: 0, low: 0 }]]);
    const result = (await getAdminAnalyticsDataHandler({ data: { range: '30d' } })) as any;
    expect(result.atRiskSummary).toEqual({ high: 0, medium: 0, low: 0 });
  });

  it('should default to zeros when query returns empty array', async () => {
    mockResults([...emptyStandard, []]);
    const result = (await getAdminAnalyticsDataHandler({ data: { range: '30d' } })) as any;
    expect(result.atRiskSummary).toEqual({ high: 0, medium: 0, low: 0 });
  });

  it('should include atRiskSummary as numbers in response', async () => {
    mockResults([...emptyStandard, [{ high: 2, medium: 4, low: 1 }]]);
    const result = (await getAdminAnalyticsDataHandler({ data: { range: '30d' } })) as any;
    expect(result.atRiskSummary).toBeDefined();
    expect(typeof result.atRiskSummary.high).toBe('number');
    expect(typeof result.atRiskSummary.medium).toBe('number');
    expect(typeof result.atRiskSummary.low).toBe('number');
  });
});
