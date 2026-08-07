/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '@/db/index';
import { logAuditEvent } from '@/lib/audit';
import { ErrorCode, isServerError } from '@/lib/errors';
import { getSessionFromHeaders } from '@/server/auth';
import { transitionAssignmentStatusHandler } from '@/server/assignments-lifecycle.server';

vi.mock('@/db/index', () => ({ getDb: vi.fn() }));
vi.mock('@/lib/audit', () => ({ logAuditEvent: vi.fn() }));
vi.mock('@/server/auth', () => ({ getSessionFromHeaders: vi.fn() }));

const instructorSession = {
  user: { id: 'instructor-1', role: 'instructor' as const },
  session: {},
};

function createDb(
  options: {
    assignmentRows?: unknown[];
    updatedRows?: unknown[];
    transactionError?: Error;
  } = {},
) {
  const assignmentRows = options.assignmentRows ?? [{ id: 7, status: 'draft', sectionId: 12 }];
  const updatedRows = options.updatedRows ?? [{ id: 7, status: 'active' }];
  const selectBuilder: any = {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    for: vi.fn().mockResolvedValue(assignmentRows),
  };
  const updateBuilder: any = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(updatedRows),
  };
  const transaction = vi.fn(async (callback: (tx: any) => Promise<unknown>) => {
    if (options.transactionError) throw options.transactionError;
    return callback({
      select: vi.fn(() => selectBuilder),
      update: vi.fn(() => updateBuilder),
    });
  });
  const db = { transaction };
  vi.mocked(getDb).mockReturnValue(db as never);
  return { db, selectBuilder, updateBuilder };
}

function expectError(result: unknown, code: ErrorCode) {
  expect(isServerError(result)).toBe(true);
  if (isServerError(result)) expect(result.error.code).toBe(code);
}

describe('transitionAssignmentStatusHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSessionFromHeaders).mockResolvedValue(instructorSession as never);
  });

  it('rejects unauthenticated and non-instructor sessions before opening a transaction', async () => {
    const { db } = createDb();
    vi.mocked(getSessionFromHeaders).mockResolvedValueOnce(null as never);
    expectError(
      await transitionAssignmentStatusHandler({ data: { assignmentId: 7, status: 'active' } }),
      ErrorCode.UNAUTHORIZED,
    );

    vi.mocked(getSessionFromHeaders).mockResolvedValueOnce({
      user: { id: 'student-1', role: 'student' },
      session: {},
    } as never);
    expectError(
      await transitionAssignmentStatusHandler({ data: { assignmentId: 7, status: 'active' } }),
      ErrorCode.UNAUTHORIZED,
    );
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it('returns not found when the instructor cannot access the assignment', async () => {
    const { db } = createDb({ assignmentRows: [] });
    expectError(
      await transitionAssignmentStatusHandler({ data: { assignmentId: 7, status: 'active' } }),
      ErrorCode.NOT_FOUND,
    );
    expect(db.transaction).toHaveBeenCalledOnce();
  });

  it('rejects unsupported transitions, including unknown current statuses', async () => {
    createDb({ assignmentRows: [{ id: 7, status: 'draft', sectionId: 12 }] });
    expectError(
      await transitionAssignmentStatusHandler({ data: { assignmentId: 7, status: 'archived' } }),
      ErrorCode.CONFLICT,
    );

    createDb({ assignmentRows: [{ id: 7, status: 'archived', sectionId: 12 }] });
    expectError(
      await transitionAssignmentStatusHandler({ data: { assignmentId: 7, status: 'active' } }),
      ErrorCode.CONFLICT,
    );

    createDb({ assignmentRows: [{ id: 7, status: 'unexpected', sectionId: 12 }] });
    expectError(
      await transitionAssignmentStatusHandler({ data: { assignmentId: 7, status: 'active' } }),
      ErrorCode.CONFLICT,
    );
  });

  it('transitions draft assignments to active and records an audit event', async () => {
    const { updateBuilder } = createDb();
    const result = await transitionAssignmentStatusHandler({
      data: { assignmentId: 7, status: 'active' },
    });

    expect(result).toEqual({ success: true, assignmentId: 7, status: 'active' });
    expect(updateBuilder.returning).toHaveBeenCalledOnce();
    expect(logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'assignment.lifecycle.transitioned',
        entityId: '7',
        details: { previousStatus: 'draft', status: 'active', sectionId: 12 },
      }),
    );
  });

  it('transitions active assignments to archived', async () => {
    createDb({
      assignmentRows: [{ id: 7, status: 'active', sectionId: 12 }],
      updatedRows: [{ id: 7, status: 'archived' }],
    });
    const result = await transitionAssignmentStatusHandler({
      data: { assignmentId: 7, status: 'archived' },
    });

    expect(result).toEqual({ success: true, assignmentId: 7, status: 'archived' });
  });

  it('returns a conflict when the locked row changes before the update', async () => {
    createDb({ updatedRows: [] });
    expectError(
      await transitionAssignmentStatusHandler({ data: { assignmentId: 7, status: 'active' } }),
      ErrorCode.CONFLICT,
    );
  });

  it('maps transaction failures to an internal error', async () => {
    createDb({ transactionError: new Error('database unavailable') });
    expectError(
      await transitionAssignmentStatusHandler({ data: { assignmentId: 7, status: 'active' } }),
      ErrorCode.INTERNAL,
    );
  });
});
