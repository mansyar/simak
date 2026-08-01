/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '@/db/index';
import * as auth from '@/server/auth';
import * as audit from '@/lib/audit';
import {
  getInterventionContextHandler,
  listInterventionsHandler,
  updateInterventionHandler,
} from '@/server/interventions.server';
import { getLiveStudentRiskContexts } from '@/server/student-risk-context.server';

vi.mock('@/server/auth', () => ({ getSessionFromHeaders: vi.fn() }));
vi.mock('@/db/index', () => ({ getDb: vi.fn() }));
vi.mock('@/lib/audit', () => ({ safeAuditLog: vi.fn() }));
vi.mock('@/server/student-risk-context.server', () => ({
  getLiveStudentRiskContexts: vi.fn(),
}));

const formerOwner = { user: { id: 'instructor-1', role: 'instructor' } };
const replacementOwner = { user: { id: 'instructor-2', role: 'instructor' } };
const unrelatedInstructor = { user: { id: 'instructor-3', role: 'instructor' } };
const student = { user: { id: 'student-1', role: 'student' } };
const admin = { user: { id: 'admin-1', role: 'admin' } };

function createMockDb() {
  const mockDb: any = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    for: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
    transaction: vi.fn(async (callback: (tx: any) => unknown) => callback(mockDb)),
    then: vi.fn(function (onfulfilled: any) {
      return Promise.resolve([]).then(onfulfilled);
    }),
  };
  return mockDb;
}

function queueResults(mockDb: any, ...results: unknown[]) {
  for (const result of results) {
    mockDb.then.mockImplementationOnce((onfulfilled: any) =>
      Promise.resolve(result).then(onfulfilled),
    );
  }
}

const intervention = {
  id: 42,
  assignmentId: 1,
  studentId: 'student-1',
  status: 'open',
  followUpDate: null,
};

const liveContext = {
  studentId: 'student-1',
  studentName: 'Student One',
  assignmentId: 1,
  assignmentTitle: 'Assignment One',
  checkpoints: [],
  assessment: { level: 'high', factors: [] },
};

describe('intervention privacy after assignment reassignment', () => {
  let mockDb: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    vi.mocked(getDb).mockReturnValue(mockDb);
    vi.mocked(getLiveStudentRiskContexts).mockResolvedValue([liveContext] as any);
  });

  it('shows records to the replacement owner but not the former or unrelated instructor', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(formerOwner as any);
    queueResults(mockDb, [], [{ count: 0 }]);
    expect(
      await listInterventionsHandler({ data: { page: 1, limit: 20, overdue: false } }),
    ).toEqual({ interventions: [], total: 0, page: 1, limit: 20 });

    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(replacementOwner as any);
    queueResults(mockDb, [intervention], [{ count: 1 }]);
    expect(
      await listInterventionsHandler({ data: { page: 1, limit: 20, overdue: false } }),
    ).toEqual({ interventions: [intervention], total: 1, page: 1, limit: 20 });

    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(unrelatedInstructor as any);
    queueResults(mockDb, [], [{ count: 0 }]);
    expect(
      await listInterventionsHandler({ data: { page: 1, limit: 20, overdue: false } }),
    ).toEqual({ interventions: [], total: 0, page: 1, limit: 20 });
  });

  it('allows the replacement owner to load live context while denying the former owner', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(formerOwner as any);
    queueResults(mockDb, []);
    expect(
      await getInterventionContextHandler({ data: { assignmentId: 1, studentId: 'student-1' } }),
    ).toEqual({ error: { code: 'NOT_FOUND', message: 'Assignment or student not found' } });

    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(replacementOwner as any);
    queueResults(mockDb, [{ id: 1 }], [{ id: 10 }]);
    expect(
      await getInterventionContextHandler({ data: { assignmentId: 1, studentId: 'student-1' } }),
    ).toEqual({ context: liveContext });
  });

  it('rejects student and admin access without querying intervention records', async () => {
    for (const session of [student, admin]) {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(session as any);
      const result = await listInterventionsHandler({
        data: { page: 1, limit: 20, overdue: false },
      });
      expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
    }
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it('keeps the replacement instructor as the audit actor for later updates', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(replacementOwner as any);
    queueResults(
      mockDb,
      [
        {
          id: 42,
          assignmentId: 1,
          studentId: 'student-1',
          actionType: 'discussion',
          privateNote: null,
          status: 'open',
          followUpDate: null,
          resolutionReason: null,
        },
      ],
      [{ id: 42, status: 'monitoring' }],
    );

    const result = await updateInterventionHandler({
      data: { interventionId: 42, status: 'monitoring' },
    } as any);

    expect(result).toEqual({ intervention: { id: 42, status: 'monitoring' } });
    expect(audit.safeAuditLog).toHaveBeenCalledWith(
      'intervention.updated',
      expect.objectContaining({ actorId: 'instructor-2', entityId: '42' }),
    );
  });
});
