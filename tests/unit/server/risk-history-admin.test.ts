/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/server/auth', () => ({ getSessionFromHeaders: vi.fn() }));
vi.mock('@/db/index', () => ({ getDb: vi.fn() }));
vi.mock('@/lib/audit', () => ({ safeAuditLog: vi.fn() }));

import { getDb } from '@/db/index';
import { safeAuditLog } from '@/lib/audit';
import { getSessionFromHeaders } from '@/server/auth';
import { getAdminRiskTrendsHandler } from '@/server/risk-history.server';

function createDb(results: unknown[][]) {
  const db = {
    select: vi.fn(() => {
      const result = results.shift() ?? [];
      const chain: any = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
      };
      return chain;
    }),
  };
  return db;
}

const input = {
  termId: 3,
  courseId: null,
  sectionId: 8,
  from: new Date('2026-01-01T00:00:00.000Z'),
  to: new Date('2026-08-10T23:59:59.000Z'),
};

describe('getAdminRiskTrendsHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSessionFromHeaders).mockResolvedValue({
      user: { id: 'admin-1', role: 'admin' },
    } as any);
  });

  it('denies non-admin roles before querying aggregate data', async () => {
    vi.mocked(getSessionFromHeaders).mockResolvedValue({
      user: { id: 'instructor-1', role: 'instructor' },
    } as any);
    const db = createDb([]);
    vi.mocked(getDb).mockReturnValue(db as any);

    await expect(getAdminRiskTrendsHandler({ data: input })).resolves.toEqual({
      error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
    });
    expect(db.select).not.toHaveBeenCalled();
  });

  it('suppresses cohorts below ten students without running a trend drill-down', async () => {
    const db = createDb([[{ cohortSize: 9 }]]);
    vi.mocked(getDb).mockReturnValue(db as any);

    await expect(getAdminRiskTrendsHandler({ data: input })).resolves.toEqual({
      suppressed: true,
      minimumCohortSize: 10,
      cohortSize: 9,
      trends: [],
    });
    expect(db.select).toHaveBeenCalledTimes(1);
    expect(safeAuditLog).toHaveBeenCalledWith(
      'risk_history.admin_aggregate_viewed',
      expect.objectContaining({ details: expect.objectContaining({ suppressed: true }) }),
    );
  });

  it('returns only bounded cohort aggregates for an authorized academic context', async () => {
    const trends = [
      { date: '2026-08-09', riskLevel: 'high', observationCount: 7 },
      { date: '2026-08-10', riskLevel: 'medium', observationCount: 11 },
    ];
    const db = createDb([[{ cohortSize: 12 }], trends]);
    vi.mocked(getDb).mockReturnValue(db as any);

    const result = await getAdminRiskTrendsHandler({ data: input });

    expect(result).toEqual({
      suppressed: false,
      minimumCohortSize: 10,
      cohortSize: 12,
      trends,
    });
    expect(JSON.stringify(result)).not.toMatch(/studentId|assignmentId|factor|explanation/i);
    expect(safeAuditLog).toHaveBeenCalledWith(
      'risk_history.admin_aggregate_viewed',
      expect.objectContaining({
        actorId: 'admin-1',
        details: expect.objectContaining({ termId: 3, sectionId: 8, suppressed: false }),
      }),
    );
  });
});
