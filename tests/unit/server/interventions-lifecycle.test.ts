/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '@/db/index';
import * as audit from '@/lib/audit';
import * as auth from '@/server/auth';
import { updateInterventionHandler } from '@/server/interventions.server';

vi.mock('@/server/auth', () => ({ getSessionFromHeaders: vi.fn() }));
vi.mock('@/db/index', () => ({ getDb: vi.fn() }));
vi.mock('@/lib/audit', () => ({ safeAuditLog: vi.fn() }));

const instructorSession = { user: { id: 'instructor-1', role: 'instructor' } };
const studentSession = { user: { id: 'student-1', role: 'student' } };

function createMockDb() {
  const mockDb: any = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    for: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
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

function activeRecord(status: 'open' | 'monitoring' = 'open') {
  return {
    id: 42,
    assignmentId: 1,
    studentId: 'student-1',
    status,
    instructorId: 'instructor-1',
  };
}

describe('updateInterventionHandler', () => {
  let mockDb: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    vi.mocked(getDb).mockReturnValue(mockDb);
  });

  it('rejects non-instructors without querying private records', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);

    const result = await updateInterventionHandler({
      data: { interventionId: 42, status: 'monitoring' },
    } as any);

    expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it('allows open to monitoring and locks the current owner record', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
    queueResults(mockDb, [activeRecord('open')], [{ id: 42, status: 'monitoring' }]);

    const result = await updateInterventionHandler({
      data: { interventionId: 42, status: 'monitoring' },
    } as any);

    expect(result).toEqual({ intervention: { id: 42, status: 'monitoring' } });
    expect(mockDb.transaction).toHaveBeenCalled();
    expect(mockDb.for).toHaveBeenCalledWith('update', expect.any(Object));
    expect(mockDb.update).toHaveBeenCalled();
  });

  it('allows monitoring back to open and closes with an immutable reason audit event', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
    queueResults(mockDb, [activeRecord('monitoring')], [{ id: 42, status: 'resolved' }]);

    const result = await updateInterventionHandler({
      data: {
        interventionId: 42,
        status: 'resolved',
        resolutionReason: 'Student submitted the missing work',
      },
    } as any);

    expect(result).toEqual({ intervention: { id: 42, status: 'resolved' } });
    expect(audit.safeAuditLog).toHaveBeenCalledWith(
      'intervention.resolved',
      expect.objectContaining({
        actorId: 'instructor-1',
        action: 'intervention.resolved',
        entityId: '42',
        details: expect.objectContaining({
          previousStatus: 'monitoring',
          status: 'resolved',
          reason: 'Student submitted the missing work',
        }),
      }),
    );
  });

  it('allows dismissal with a reason and retains the actor in the audit event', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
    queueResults(mockDb, [activeRecord('open')], [{ id: 42, status: 'dismissed' }]);

    const result = await updateInterventionHandler({
      data: { interventionId: 42, status: 'dismissed', resolutionReason: 'False positive' },
    } as any);

    expect(result).toEqual({ intervention: { id: 42, status: 'dismissed' } });
    expect(audit.safeAuditLog).toHaveBeenCalledWith(
      'intervention.dismissed',
      expect.objectContaining({ actorId: 'instructor-1' }),
    );
  });

  it('rejects closure without a non-empty reason and invalid transitions', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
    queueResults(mockDb, [activeRecord('open')]);

    const missingReason = await updateInterventionHandler({
      data: { interventionId: 42, status: 'resolved' },
    } as any);
    expect(missingReason).toEqual({
      error: { code: 'BAD_REQUEST', message: 'A resolution or dismissal reason is required' },
    });

    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
    queueResults(mockDb, [activeRecord('open')]);
    const sameStatus = await updateInterventionHandler({
      data: { interventionId: 42, status: 'open' },
    } as any);
    expect(sameStatus).toEqual({
      error: { code: 'BAD_REQUEST', message: 'Invalid intervention status transition' },
    });
  });

  it('rejects all updates to terminal records', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
    queueResults(mockDb, [{ ...activeRecord(), status: 'resolved' }]);

    const result = await updateInterventionHandler({
      data: { interventionId: 42, privateNote: 'Late note' },
    } as any);

    expect(result).toEqual({
      error: { code: 'BAD_REQUEST', message: 'Resolved and dismissed interventions are immutable' },
    });
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('updates action, private note, and follow-up date without creating notifications', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
    queueResults(mockDb, [activeRecord('open')], [{ id: 42, actionType: 'extension' }]);
    const followUpDate = new Date('2026-08-05T00:00:00.000Z');

    const result = await updateInterventionHandler({
      data: {
        interventionId: 42,
        actionType: 'extension',
        privateNote: 'Discuss extension options',
        followUpDate,
      },
    } as any);

    expect(result).toEqual({ intervention: { id: 42, actionType: 'extension' } });
    expect(mockDb.update).toHaveBeenCalled();
  });

  it('denies a former owner after reassignment while allowing the replacement owner', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
    queueResults(mockDb, []);

    const formerOwnerResult = await updateInterventionHandler({
      data: { interventionId: 42, status: 'monitoring' },
    } as any);
    expect(formerOwnerResult).toEqual({
      error: { code: 'NOT_FOUND', message: 'Intervention not found' },
    });

    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
      user: { id: 'replacement-instructor', role: 'instructor' },
    } as any);
    queueResults(
      mockDb,
      [{ ...activeRecord(), instructorId: 'replacement-instructor' }],
      [{ id: 42, status: 'monitoring' }],
    );
    const replacementResult = await updateInterventionHandler({
      data: { interventionId: 42, status: 'monitoring' },
    } as any);
    expect(replacementResult).toEqual({ intervention: { id: 42, status: 'monitoring' } });
  });
});
