/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/server/auth', () => ({ getSessionFromHeaders: vi.fn() }));
vi.mock('@/db/index', () => ({ getDb: vi.fn() }));
vi.mock('@/lib/audit', () => ({ safeAuditLog: vi.fn() }));

import { getDb } from '@/db/index';
import { safeAuditLog } from '@/lib/audit';
import { getSessionFromHeaders } from '@/server/auth';
import { listInstructorRiskHistoryHandler } from '@/server/risk-history.server';

function createDb(results: unknown[][]) {
  const chains: any[] = [];
  const db = {
    select: vi.fn(() => {
      const result = results.shift() ?? [];
      const chain: any = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockReturnThis(),
        then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
      };
      chains.push(chain);
      return chain;
    }),
  };
  return { db, chains };
}

const input = {
  assignmentId: 12,
  studentId: 'student-1',
  from: new Date('2026-08-01T00:00:00.000Z'),
  to: new Date('2026-08-10T23:59:59.000Z'),
  page: 1,
  limit: 20,
};

describe('listInstructorRiskHistoryHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSessionFromHeaders).mockResolvedValue({
      user: { id: 'instructor-current', role: 'instructor' },
    } as any);
  });

  it('returns ordered observations and fact-based outcomes without private intervention fields', async () => {
    const observation = {
      id: 9,
      source: 'daily_snapshot',
      eventType: null,
      observedAt: new Date('2026-08-10T00:00:00.000Z'),
      algorithmVersion: 'risk-v1',
      riskLevel: 'medium',
      factors: [{ code: 'overdue', category: 'student_inaction', severity: 'high' }],
      explanationSnapshot: { version: 'v1' },
      checkpointId: null,
      interventionId: null,
    };
    const intervention = {
      id: 5,
      actionType: 'consultation',
      status: 'monitoring',
      followUpDate: new Date('2026-08-15T00:00:00.000Z'),
      createdAt: new Date('2026-08-02T00:00:00.000Z'),
      updatedAt: new Date('2026-08-09T00:00:00.000Z'),
    };
    const { db, chains } = createDb([
      [{ id: 12 }],
      [observation],
      [{ count: 1 }],
      [{ total: 4, passed: 2 }],
      [{ submissions: 3, reviews: 2 }],
      [{ verified: 1 }],
      [intervention],
    ]);
    vi.mocked(getDb).mockReturnValue(db as any);

    const result = await listInstructorRiskHistoryHandler({ data: input });

    expect(result).toEqual({
      observations: [observation],
      total: 1,
      page: 1,
      limit: 20,
      outcomes: {
        facts: {
          checkpointTotal: 4,
          checkpointPassed: 2,
          submissionCount: 3,
          reviewCount: 2,
          verifiedConsultationCount: 1,
        },
        interpretation: {
          academicProgress: 'in_progress',
          engagement: 'engaged',
        },
        interventionBasis: [intervention],
      },
    });
    expect(chains[1].orderBy).toHaveBeenCalled();
    expect(safeAuditLog).toHaveBeenCalledWith(
      'risk_history.instructor_viewed',
      expect.objectContaining({
        actorId: 'instructor-current',
        details: { assignmentId: 12, studentId: 'student-1' },
      }),
    );
    expect(JSON.stringify(result)).not.toContain('privateNote');
    expect(JSON.stringify(result)).not.toContain('resolutionReason');
  });

  it('denies non-instructors before querying history', async () => {
    vi.mocked(getSessionFromHeaders).mockResolvedValue({
      user: { id: 'admin-1', role: 'admin' },
    } as any);
    const { db } = createDb([]);
    vi.mocked(getDb).mockReturnValue(db as any);

    await expect(listInstructorRiskHistoryHandler({ data: input })).resolves.toEqual({
      error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
    });
    expect(db.select).not.toHaveBeenCalled();
  });

  it('removes access from a former owner after reassignment', async () => {
    const { db } = createDb([[]]);
    vi.mocked(getDb).mockReturnValue(db as any);

    await expect(listInstructorRiskHistoryHandler({ data: input })).resolves.toEqual({
      error: { code: 'NOT_FOUND', message: 'Assignment or student not found' },
    });
    expect(safeAuditLog).toHaveBeenCalledWith(
      'risk_history.instructor_denied',
      expect.objectContaining({ actorId: 'instructor-current' }),
    );
  });
});
