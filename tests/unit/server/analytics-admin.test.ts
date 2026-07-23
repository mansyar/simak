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

const superadminSession = {
  user: { id: 'super-1', role: 'superadmin' as const },
  session: {} as any,
};

const studentSession = {
  user: { id: 'student-1', role: 'student' as const },
  session: {} as any,
};

describe('getAdminAnalyticsDataHandler', () => {
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
  });

  /** Set up 8 query results for Promise.all, in order:
   * 0: consultation stats, 1: deadline stats, 2: status distribution,
   * 3: submission trend, 4: review trend, 5: reviews count,
   * 6: DAU trend, 7: WAU trend */
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
  ];

  describe('role guard', () => {
    it('should reject if unauthorized (no session)', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);
      const result = await getAdminAnalyticsDataHandler({ data: { range: '30d' } });
      expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
    });

    it('should reject if not an admin', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);
      const result = await getAdminAnalyticsDataHandler({ data: { range: '30d' } });
      expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
    });

    it('should accept superadmin role', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(superadminSession as any);
      mockResults(emptyResults);
      const result = (await getAdminAnalyticsDataHandler({ data: { range: '30d' } })) as any;
      expect(result).not.toHaveProperty('error');
      expect(result).toHaveProperty('consultationVerificationRate');
    });
  });

  describe('date range filtering', () => {
    beforeEach(() => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession as any);
    });

    it('should resolve 30d range with non-null start/end', async () => {
      mockResults(emptyResults);
      const result = (await getAdminAnalyticsDataHandler({ data: { range: '30d' } })) as any;
      expect(result.dateRange.start).not.toBeNull();
      expect(result.dateRange.end).not.toBeNull();
    });

    it('should resolve 7d range', async () => {
      mockResults(emptyResults);
      const result = (await getAdminAnalyticsDataHandler({ data: { range: '7d' } })) as any;
      expect(result.dateRange.start).not.toBeNull();
    });

    it('should resolve 90d range', async () => {
      mockResults(emptyResults);
      const result = (await getAdminAnalyticsDataHandler({ data: { range: '90d' } })) as any;
      expect(result.dateRange.start).not.toBeNull();
    });

    it('should resolve "all" range with null start/end', async () => {
      mockResults(emptyResults);
      const result = (await getAdminAnalyticsDataHandler({ data: { range: 'all' } })) as any;
      expect(result.dateRange.start).toBeNull();
      expect(result.dateRange.end).toBeNull();
    });

    it('should resolve default (no range) as all', async () => {
      mockResults(emptyResults);
      const result = (await getAdminAnalyticsDataHandler({ data: {} })) as any;
      expect(result.dateRange.start).toBeNull();
      expect(result.dateRange.end).toBeNull();
    });

    it('should resolve custom start/end dates', async () => {
      const start = new Date('2026-01-01T00:00:00Z');
      const end = new Date('2026-06-30T23:59:59Z');
      mockResults(emptyResults);
      const result = (await getAdminAnalyticsDataHandler({ data: { start, end } })) as any;
      expect(result.dateRange.start).toBe(start.toISOString());
      expect(result.dateRange.end).toBe(end.toISOString());
    });
  });

  describe('metric calculations', () => {
    beforeEach(() => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession as any);
    });

    it('should calculate consultation verification rate as percentage', async () => {
      mockResults([
        [{ total: 10, verified: 8 }],
        [{ total: 0, breached: 0 }],
        [],
        [],
        [],
        [{ count: 0 }],
        [],
        [],
      ]);
      const result = (await getAdminAnalyticsDataHandler({ data: { range: '30d' } })) as any;
      expect(result.consultationVerificationRate).toBe(80);
    });

    it('should return 0% verification rate when no consultations', async () => {
      mockResults([
        [{ total: 0, verified: 0 }],
        [{ total: 0, breached: 0 }],
        [],
        [],
        [],
        [{ count: 0 }],
        [],
        [],
      ]);
      const result = (await getAdminAnalyticsDataHandler({ data: { range: '30d' } })) as any;
      expect(result.consultationVerificationRate).toBe(0);
    });

    it('should calculate deadline breach rate as percentage', async () => {
      mockResults([
        [{ total: 0, verified: 0 }],
        [{ total: 10, breached: 3 }],
        [],
        [],
        [],
        [{ count: 0 }],
        [],
        [],
      ]);
      const result = (await getAdminAnalyticsDataHandler({ data: { range: '30d' } })) as any;
      expect(result.deadlineBreachRate).toBe(30);
    });

    it('should return 0% breach rate when no checkpoints', async () => {
      mockResults([
        [{ total: 0, verified: 0 }],
        [{ total: 0, breached: 0 }],
        [],
        [],
        [],
        [{ count: 0 }],
        [],
        [],
      ]);
      const result = (await getAdminAnalyticsDataHandler({ data: { range: '30d' } })) as any;
      expect(result.deadlineBreachRate).toBe(0);
    });

    it('should return status distribution array with state and count', async () => {
      mockResults([
        [{ total: 0, verified: 0 }],
        [{ total: 0, breached: 0 }],
        [
          { state: 'locked', count: 5 },
          { state: 'unlocked', count: 3 },
          { state: 'passed', count: 2 },
        ],
        [],
        [],
        [{ count: 0 }],
        [],
        [],
      ]);
      const result = (await getAdminAnalyticsDataHandler({ data: { range: '30d' } })) as any;
      expect(result.statusDistribution).toHaveLength(3);
      expect(result.statusDistribution[0]).toEqual({ state: 'locked', count: 5 });
      expect(result.statusDistribution[2]).toEqual({ state: 'passed', count: 2 });
    });

    it('should return reviews completed count', async () => {
      mockResults([
        [{ total: 0, verified: 0 }],
        [{ total: 0, breached: 0 }],
        [],
        [],
        [],
        [{ count: 42 }],
        [],
        [],
      ]);
      const result = (await getAdminAnalyticsDataHandler({ data: { range: '30d' } })) as any;
      expect(result.reviewsCompleted).toBe(42);
    });

    it('should return submission and review volume trends', async () => {
      mockResults([
        [{ total: 0, verified: 0 }],
        [{ total: 0, breached: 0 }],
        [],
        [
          { date: '2026-07-01', count: 5 },
          { date: '2026-07-02', count: 3 },
        ],
        [{ date: '2026-07-01', count: 2 }],
        [{ count: 0 }],
        [],
        [],
      ]);
      const result = (await getAdminAnalyticsDataHandler({ data: { range: '30d' } })) as any;
      expect(result.submissionTrend).toHaveLength(2);
      expect(result.submissionTrend[0]).toEqual({ date: '2026-07-01', count: 5 });
      expect(result.reviewTrend).toHaveLength(1);
      expect(result.reviewTrend[0]).toEqual({ date: '2026-07-01', count: 2 });
    });

    it('should return DAU and WAU trends', async () => {
      mockResults([
        [{ total: 0, verified: 0 }],
        [{ total: 0, breached: 0 }],
        [],
        [],
        [],
        [{ count: 0 }],
        [
          { date: '2026-07-01', activeUsers: 15 },
          { date: '2026-07-02', activeUsers: 20 },
        ],
        [{ date: '2026-06-29', activeUsers: 45 }],
      ]);
      const result = (await getAdminAnalyticsDataHandler({ data: { range: '30d' } })) as any;
      expect(result.dauTrend).toHaveLength(2);
      expect(result.dauTrend[0]).toEqual({ date: '2026-07-01', activeUsers: 15 });
      expect(result.wauTrend).toHaveLength(1);
      expect(result.wauTrend[0]).toEqual({ date: '2026-06-29', activeUsers: 45 });
    });

    it('should return all expected top-level fields', async () => {
      mockResults(emptyResults);
      const result = (await getAdminAnalyticsDataHandler({ data: { range: '30d' } })) as any;
      expect(result).toHaveProperty('consultationVerificationRate');
      expect(result).toHaveProperty('deadlineBreachRate');
      expect(result).toHaveProperty('statusDistribution');
      expect(result).toHaveProperty('submissionTrend');
      expect(result).toHaveProperty('reviewTrend');
      expect(result).toHaveProperty('reviewsCompleted');
      expect(result).toHaveProperty('dauTrend');
      expect(result).toHaveProperty('wauTrend');
      expect(result).toHaveProperty('dateRange');
    });
  });

  describe('error handling', () => {
    it('should return INTERNAL error on DB failure', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession as any);
      mockDb.then.mockImplementation(() => {
        throw new Error('DB connection failed');
      });

      const result = await getAdminAnalyticsDataHandler({ data: { range: '30d' } });
      expect(result).toEqual({
        error: {
          code: 'INTERNAL',
          message: 'Internal Server Error',
        },
      });
    });
  });
});
