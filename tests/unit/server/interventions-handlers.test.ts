/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '@/db/index';
import * as auth from '@/server/auth';
import { getLiveStudentRiskContexts } from '@/server/student-risk-context.server';
import {
  createInterventionHandler,
  getInterventionContextHandler,
  listInterventionsHandler,
} from '@/server/interventions.server';

vi.mock('@/server/auth', () => ({ getSessionFromHeaders: vi.fn() }));
vi.mock('@/db/index', () => ({ getDb: vi.fn() }));
vi.mock('@/lib/audit', () => ({ safeAuditLog: vi.fn() }));
vi.mock('@/server/student-risk-context.server', () => ({
  getLiveStudentRiskContexts: vi.fn(),
}));

const instructorSession = { user: { id: 'instructor-1', role: 'instructor' } };
const studentSession = { user: { id: 'student-1', role: 'student' } };
const adminSession = { user: { id: 'admin-1', role: 'admin' } };

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
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
    transaction: vi.fn(async (callback: (tx: any) => unknown) => callback(mockDb)),
    then: vi.fn(function (this: any, onfulfilled: (value: unknown) => unknown) {
      return Promise.resolve([]).then(onfulfilled);
    }),
  };
  return mockDb;
}

function queueResults(mockDb: any, ...results: unknown[]) {
  for (const result of results) {
    mockDb.then.mockImplementationOnce((onfulfilled: (value: unknown) => unknown) =>
      Promise.resolve(result).then(onfulfilled),
    );
  }
}

function eligibleContext() {
  return {
    studentId: 'student-1',
    studentName: 'Student One',
    assignmentId: 1,
    assignmentTitle: 'Assignment One',
    checkpoints: [],
    assessment: {
      level: 'high' as const,
      factors: [
        {
          type: 'overdue_checkpoint' as const,
          severity: 'high' as const,
          category: 'student_inaction' as const,
          checkpointId: 11,
          description: 'Checkpoint is overdue',
        },
      ],
    },
  };
}

describe('intervention server handlers', () => {
  let mockDb: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    vi.mocked(getDb).mockReturnValue(mockDb);
  });

  it('rejects students and admins without querying private intervention data', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);
    expect(
      await listInterventionsHandler({ data: { page: 1, limit: 20, overdue: false } }),
    ).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession as any);
    expect(
      await getInterventionContextHandler({ data: { assignmentId: 1, studentId: 'student-1' } }),
    ).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it('rejects creation when the assignment or student is not owned by the instructor', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
    queueResults(mockDb, []);

    const result = await createInterventionHandler({
      data: {
        assignmentId: 99,
        studentId: 'student-1',
        actionType: 'consultation',
      },
    });

    expect(result).toEqual({
      error: { code: 'NOT_FOUND', message: 'Assignment or student not found' },
    });
  });

  it('rejects pending-review-only risk and accepts only live student-inaction risk', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
    queueResults(mockDb, [{ id: 1 }], [{ id: 2 }]);
    vi.mocked(getLiveStudentRiskContexts).mockResolvedValue([
      {
        ...eligibleContext(),
        assessment: {
          level: 'low',
          factors: [
            {
              type: 'stalled_review',
              severity: 'low',
              category: 'pending_review',
              checkpointId: 11,
              description: 'Submission awaiting review beyond SLA',
            },
          ],
        },
      },
    ] as any);

    const result = await createInterventionHandler({
      data: {
        assignmentId: 1,
        studentId: 'student-1',
        actionType: 'discussion',
      },
    });

    expect(result).toEqual({
      error: {
        code: 'BAD_REQUEST',
        message: 'An intervention requires a live student-inaction risk factor',
      },
    });
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it('creates an intervention in a transaction and records the eligible live context', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
    queueResults(mockDb, [{ id: 1 }], [{ id: 2 }], [{ id: 42 }]);
    vi.mocked(getLiveStudentRiskContexts).mockResolvedValue([eligibleContext()]);

    const result = await createInterventionHandler({
      data: {
        assignmentId: 1,
        studentId: 'student-1',
        actionType: 'consultation',
        privateNote: 'Invite student to office hours',
      },
    });

    expect(result).toEqual({ intervention: { id: 42 } });
    expect(mockDb.transaction).toHaveBeenCalled();
    expect(mockDb.for).toHaveBeenCalledWith('update', expect.any(Object));
    expect(getLiveStudentRiskContexts).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ assignmentIds: [1], studentId: 'student-1' }),
    );
  });

  it('turns the active unique-index race into a conflict response', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
    queueResults(mockDb, [{ id: 1 }], [{ id: 2 }]);
    vi.mocked(getLiveStudentRiskContexts).mockResolvedValue([eligibleContext()]);
    mockDb.then.mockImplementationOnce(
      (_onfulfilled: (value: unknown) => unknown, onrejected: (reason: unknown) => unknown) => {
        onrejected({ code: '23505' });
        return Promise.resolve();
      },
    );

    const result = await createInterventionHandler({
      data: { assignmentId: 1, studentId: 'student-1', actionType: 'other' },
    });

    expect(result).toEqual({
      error: {
        code: 'CONFLICT',
        message: 'An active intervention already exists for this student',
      },
    });
  });

  it('lists only instructor-visible records with status and overdue filters applied server-side', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
    const intervention = {
      id: 42,
      assignmentId: 1,
      studentId: 'student-1',
      status: 'open',
      followUpDate: new Date('2026-08-01T00:00:00.000Z'),
    };
    queueResults(mockDb, [intervention], [{ count: 1 }]);

    const result = await listInterventionsHandler({
      data: { assignmentId: 1, status: 'open', overdue: true, page: 2, limit: 10 },
    });

    expect(result).toEqual({ interventions: [intervention], total: 1, page: 2, limit: 10 });
    expect(mockDb.select).toHaveBeenCalled();
  });

  it('returns live context only for the current assignment owner and enrolled student', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
    queueResults(mockDb, [{ id: 1 }], [{ id: 2 }]);
    vi.mocked(getLiveStudentRiskContexts).mockResolvedValue([eligibleContext()]);

    const result = await getInterventionContextHandler({
      data: { assignmentId: 1, studentId: 'student-1' },
    });

    expect(result).toEqual({ context: eligibleContext() });
    expect(getLiveStudentRiskContexts).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ assignmentIds: [1], studentId: 'student-1' }),
    );
  });
});
