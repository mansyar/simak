/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/server/auth', () => ({ getSessionFromHeaders: vi.fn() }));
vi.mock('@/db/index', () => ({ getDb: vi.fn() }));
vi.mock('@/lib/audit', () => ({ safeAuditLog: vi.fn() }));

import { getDb } from '@/db/index';
import { safeAuditLog } from '@/lib/audit';
import { getSessionFromHeaders } from '@/server/auth';
import { getStudentSupportStatusHandler } from '@/server/risk-history.server';

function createDb(results: unknown[][]) {
  return {
    select: vi.fn(() => {
      const result = results.shift() ?? [];
      const chain: any = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
      };
      return chain;
    }),
  };
}

describe('getStudentSupportStatusHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSessionFromHeaders).mockResolvedValue({
      user: { id: 'student-1', role: 'student' },
    } as any);
  });

  it('returns only generic approved next steps for the enrolled student', async () => {
    const db = createDb([[{ assignmentId: 12 }], [{ id: 7 }]]);
    vi.mocked(getDb).mockReturnValue(db as any);

    const result = await getStudentSupportStatusHandler({ data: { assignmentId: 12 } });

    expect(result).toEqual({
      status: 'support_available',
      nextSteps: ['contact_instructor', 'review_current_work'],
    });
    expect(JSON.stringify(result)).not.toMatch(
      /risk|score|factor|explanation|note|intervention|cohort|studentId/i,
    );
    expect(safeAuditLog).toHaveBeenCalledWith(
      'risk_history.student_support_viewed',
      expect.objectContaining({
        actorId: 'student-1',
        details: { assignmentId: 12, supportAvailable: true },
      }),
    );
  });

  it('returns an on-track projection without internal history when no support is active', async () => {
    const db = createDb([[{ assignmentId: 12 }], []]);
    vi.mocked(getDb).mockReturnValue(db as any);

    await expect(getStudentSupportStatusHandler({ data: { assignmentId: 12 } })).resolves.toEqual({
      status: 'on_track',
      nextSteps: [],
    });
  });

  it('denies other roles before querying support status', async () => {
    vi.mocked(getSessionFromHeaders).mockResolvedValue({
      user: { id: 'instructor-1', role: 'instructor' },
    } as any);
    const db = createDb([]);
    vi.mocked(getDb).mockReturnValue(db as any);

    await expect(getStudentSupportStatusHandler({ data: { assignmentId: 12 } })).resolves.toEqual({
      error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
    });
    expect(db.select).not.toHaveBeenCalled();
  });

  it('does not disclose support for an assignment belonging to another student', async () => {
    const db = createDb([[]]);
    vi.mocked(getDb).mockReturnValue(db as any);

    await expect(getStudentSupportStatusHandler({ data: { assignmentId: 12 } })).resolves.toEqual({
      error: { code: 'NOT_FOUND', message: 'Assignment not found' },
    });
    expect(db.select).toHaveBeenCalledTimes(1);
  });
});
