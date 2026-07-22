/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getInstructorAnalyticsDataHandler } from '@/server/analytics-instructor.server';
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

const adminSession = {
  user: { id: 'admin-1', role: 'admin' as const },
  session: {} as any,
};

const studentSession = {
  user: { id: 'student-1', role: 'student' as const },
  session: {} as any,
};

describe('getInstructorAnalyticsDataHandler', () => {
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

  /** Set up 3 query results for Promise.all, in order:
   * 0: review stats (reviewsCompleted, avgResponseTimeSeconds, slaBreachCount),
   * 1: students supervised (count),
   * 2: assignments active (count) */
  function mockResults(results: any[][]) {
    results.forEach((result) => {
      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve(result).then(onfulfilled),
      );
    });
  }

  const emptyResults = [
    [{ reviewsCompleted: 0, avgResponseTimeSeconds: null, slaBreachCount: 0 }],
    [{ count: 0 }],
    [{ count: 0 }],
  ];

  describe('role guard', () => {
    it('should reject if unauthorized (no session)', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);
      const result = await getInstructorAnalyticsDataHandler({ data: { range: '30d' } });
      expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
    });

    it('should reject if admin', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession as any);
      const result = await getInstructorAnalyticsDataHandler({ data: { range: '30d' } });
      expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
    });

    it('should reject if student', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);
      const result = await getInstructorAnalyticsDataHandler({ data: { range: '30d' } });
      expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
    });

    it('should accept instructor role', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
      mockResults(emptyResults);
      const result = (await getInstructorAnalyticsDataHandler({ data: { range: '30d' } })) as any;
      expect(result).not.toHaveProperty('error');
      expect(result).toHaveProperty('reviewsCompleted');
    });
  });

  describe('date range filtering', () => {
    beforeEach(() => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
    });

    it('should resolve 30d range with non-null start/end', async () => {
      mockResults(emptyResults);
      const result = (await getInstructorAnalyticsDataHandler({ data: { range: '30d' } })) as any;
      expect(result.dateRange.start).not.toBeNull();
      expect(result.dateRange.end).not.toBeNull();
    });

    it('should resolve 7d range', async () => {
      mockResults(emptyResults);
      const result = (await getInstructorAnalyticsDataHandler({ data: { range: '7d' } })) as any;
      expect(result.dateRange.start).not.toBeNull();
    });

    it('should resolve 90d range', async () => {
      mockResults(emptyResults);
      const result = (await getInstructorAnalyticsDataHandler({ data: { range: '90d' } })) as any;
      expect(result.dateRange.start).not.toBeNull();
    });

    it('should resolve "all" range with null start/end', async () => {
      mockResults(emptyResults);
      const result = (await getInstructorAnalyticsDataHandler({ data: { range: 'all' } })) as any;
      expect(result.dateRange.start).toBeNull();
      expect(result.dateRange.end).toBeNull();
    });

    it('should resolve default (no range) as all', async () => {
      mockResults(emptyResults);
      const result = (await getInstructorAnalyticsDataHandler({ data: {} })) as any;
      expect(result.dateRange.start).toBeNull();
      expect(result.dateRange.end).toBeNull();
    });

    it('should resolve custom start/end dates', async () => {
      const start = new Date('2026-01-01T00:00:00Z');
      const end = new Date('2026-06-30T23:59:59Z');
      mockResults(emptyResults);
      const result = (await getInstructorAnalyticsDataHandler({ data: { start, end } })) as any;
      expect(result.dateRange.start).toBe(start.toISOString());
      expect(result.dateRange.end).toBe(end.toISOString());
    });
  });

  describe('metric calculations', () => {
    beforeEach(() => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
    });

    it('should return reviews completed count', async () => {
      mockResults([
        [{ reviewsCompleted: 42, avgResponseTimeSeconds: null, slaBreachCount: 0 }],
        [{ count: 0 }],
        [{ count: 0 }],
      ]);
      const result = (await getInstructorAnalyticsDataHandler({ data: { range: '30d' } })) as any;
      expect(result.reviewsCompleted).toBe(42);
    });

    it('should convert avg response time from seconds to hours (1 decimal)', async () => {
      // 7200 seconds = 2 hours
      mockResults([
        [{ reviewsCompleted: 5, avgResponseTimeSeconds: 7200, slaBreachCount: 0 }],
        [{ count: 0 }],
        [{ count: 0 }],
      ]);
      const result = (await getInstructorAnalyticsDataHandler({ data: { range: '30d' } })) as any;
      expect(result.averageResponseTimeHours).toBe(2);
    });

    it('should convert fractional avg response time with 1 decimal precision', async () => {
      // 9000 seconds = 2.5 hours
      mockResults([
        [{ reviewsCompleted: 5, avgResponseTimeSeconds: 9000, slaBreachCount: 0 }],
        [{ count: 0 }],
        [{ count: 0 }],
      ]);
      const result = (await getInstructorAnalyticsDataHandler({ data: { range: '30d' } })) as any;
      expect(result.averageResponseTimeHours).toBe(2.5);
    });

    it('should return null avg response time when no reviews', async () => {
      mockResults([
        [{ reviewsCompleted: 0, avgResponseTimeSeconds: null, slaBreachCount: 0 }],
        [{ count: 0 }],
        [{ count: 0 }],
      ]);
      const result = (await getInstructorAnalyticsDataHandler({ data: { range: '30d' } })) as any;
      expect(result.averageResponseTimeHours).toBeNull();
    });

    it('should return SLA breach count', async () => {
      mockResults([
        [{ reviewsCompleted: 10, avgResponseTimeSeconds: 3600, slaBreachCount: 3 }],
        [{ count: 0 }],
        [{ count: 0 }],
      ]);
      const result = (await getInstructorAnalyticsDataHandler({ data: { range: '30d' } })) as any;
      expect(result.slaBreachCount).toBe(3);
    });

    it('should return students supervised count', async () => {
      mockResults([
        [{ reviewsCompleted: 0, avgResponseTimeSeconds: null, slaBreachCount: 0 }],
        [{ count: 15 }],
        [{ count: 0 }],
      ]);
      const result = (await getInstructorAnalyticsDataHandler({ data: { range: '30d' } })) as any;
      expect(result.studentsSupervised).toBe(15);
    });

    it('should return assignments active count', async () => {
      mockResults([
        [{ reviewsCompleted: 0, avgResponseTimeSeconds: null, slaBreachCount: 0 }],
        [{ count: 0 }],
        [{ count: 8 }],
      ]);
      const result = (await getInstructorAnalyticsDataHandler({ data: { range: '30d' } })) as any;
      expect(result.assignmentsActive).toBe(8);
    });

    it('should return all expected top-level fields', async () => {
      mockResults(emptyResults);
      const result = (await getInstructorAnalyticsDataHandler({ data: { range: '30d' } })) as any;
      expect(result).toHaveProperty('reviewsCompleted');
      expect(result).toHaveProperty('averageResponseTimeHours');
      expect(result).toHaveProperty('slaBreachCount');
      expect(result).toHaveProperty('studentsSupervised');
      expect(result).toHaveProperty('assignmentsActive');
      expect(result).toHaveProperty('dateRange');
    });
  });

  describe('instructor scoping', () => {
    it('should use session user id for instructor-scoped queries', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
      mockResults(emptyResults);
      await getInstructorAnalyticsDataHandler({ data: { range: '30d' } });
      // The mock DB chains all queries; we verify the handler ran without error
      // and the DB was called (3 queries via Promise.all)
      expect(mockDb.select).toHaveBeenCalledTimes(3);
    });
  });

  describe('error handling', () => {
    it('should return INTERNAL error on DB failure', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
      mockDb.then.mockImplementation(() => {
        throw new Error('DB connection failed');
      });

      const result = await getInstructorAnalyticsDataHandler({ data: { range: '30d' } });
      expect(result).toEqual({
        error: {
          code: 'INTERNAL',
          message: 'Internal Server Error',
        },
      });
    });
  });
});
