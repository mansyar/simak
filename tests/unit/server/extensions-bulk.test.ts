/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { bulkExtendHandler } from '@/server/extensions.server';
import * as auth from '@/server/auth';
import * as dbMod from '@/db/index';
import * as auditMod from '@/lib/audit';

vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn(),
}));

vi.mock('@/db/index', () => ({
  getDb: vi.fn(),
}));

vi.mock('@/lib/audit', () => ({
  logAuditEvent: vi.fn(),
}));

vi.mock('@tanstack/react-start', () => ({
  createServerFn: vi.fn().mockReturnValue({
    inputValidator: vi.fn().mockReturnThis(),
    handler: vi.fn().mockImplementation((fn) => fn),
  }),
}));

describe('bulkExtendHandler', () => {
  let mockDb: any;
  const instructorSession = {
    user: { id: 'instructor-1', role: 'instructor' as const },
    session: {} as any,
  };
  const studentSession = {
    user: { id: 'student-1', role: 'student' as const },
    session: {} as any,
  };

  const validInput = {
    assignmentId: 1,
    studentId: 'student-1',
    extraDays: 5,
    reason: 'Class-wide deadline extension due to holiday',
  };

  function makeCheckpoints(overrides?: Partial<Record<string, unknown>>[]) {
    const defaultCheckpoints = [
      { id: 10, dueDate: new Date('2026-06-15'), name: 'Checkpoint 1' },
      { id: 11, dueDate: new Date('2026-07-01'), name: 'Checkpoint 2' },
      { id: 12, dueDate: new Date('2026-07-15'), name: 'Checkpoint 3' },
    ];
    if (!overrides || overrides.length === 0) return defaultCheckpoints;
    return defaultCheckpoints.map((cp, i) => ({
      ...cp,
      ...(overrides[i] ?? {}),
    }));
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      transaction: vi.fn(async (cb: any) => cb(mockDb)),
      then: vi.fn(function (onfulfilled: any) {
        return Promise.resolve([]).then(onfulfilled);
      }),
    };
    vi.mocked(dbMod.getDb).mockReturnValue(mockDb as any);
  });

  it('should reject if unauthorized (no session)', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);

    const result = await bulkExtendHandler({ data: validInput });
    expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
  });

  it('should reject if not an instructor', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);

    const result = await bulkExtendHandler({ data: validInput });
    expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
  });

  it('should return error if assignment not found', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);

    mockDb.then.mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled));

    const result = await bulkExtendHandler({ data: validInput });
    expect(result).toEqual({ error: { code: 'NOT_FOUND', message: 'Assignment not found' } });
  });

  it('should return error if no unfinished checkpoints found', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);

    mockDb.then
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([{ id: 1 }]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled));

    const result = await bulkExtendHandler({ data: validInput });
    expect(result).toEqual({
      error: { code: 'BAD_REQUEST', message: 'No unfinished checkpoints found for this student' },
    });
  });

  it('should extend all unfinished checkpoints (locked, unlocked, submitted, under_review, revise)', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);

    const checkpoints = [
      { id: 10, dueDate: new Date('2026-06-15'), name: 'CP1 - Locked' },
      { id: 11, dueDate: new Date('2026-07-01'), name: 'CP2 - Unlocked' },
      { id: 12, dueDate: new Date('2026-07-15'), name: 'CP3 - Submitted' },
      { id: 13, dueDate: new Date('2026-08-01'), name: 'CP4 - Under Review' },
      { id: 14, dueDate: new Date('2026-08-15'), name: 'CP5 - Revise' },
    ];

    mockDb.then
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([{ id: 1 }]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve(checkpoints).then(onfulfilled));

    const result = await bulkExtendHandler({ data: validInput });

    expect(result).toEqual({ success: true, extendedCount: 5 });

    // Transaction was called
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);

    // Each checkpoint was updated (5 update calls within transaction)
    // NOTE: The transaction uses mockDb directly, so update calls accumulate on mockDb
    expect(mockDb.update).toHaveBeenCalled();
  });

  it('should skip passed checkpoints', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);

    // Only non-passed checkpoints are returned (simulating SQL filter)
    const checkpoints = [
      { id: 10, dueDate: new Date('2026-06-15'), name: 'CP1 - Submitted' },
      { id: 12, dueDate: new Date('2026-07-15'), name: 'CP3 - Revise' },
    ];

    mockDb.then
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([{ id: 1 }]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve(checkpoints).then(onfulfilled));

    const result = await bulkExtendHandler({ data: validInput });

    expect(result).toEqual({ success: true, extendedCount: 2 });
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
  });

  it('should log individual deadline.extended audit events per checkpoint', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);

    const checkpoints = [
      { id: 10, dueDate: new Date('2026-06-15'), name: 'Checkpoint 1' },
      { id: 11, dueDate: new Date('2026-07-01'), name: 'Checkpoint 2' },
    ];

    mockDb.then
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([{ id: 1 }]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve(checkpoints).then(onfulfilled));

    await bulkExtendHandler({ data: validInput });

    // Batch INSERT — logAuditEvent not called
    expect(auditMod.logAuditEvent).not.toHaveBeenCalled();

    const valuesCalls = vi.mocked(mockDb.values).mock.calls;
    const batchAuditCall = valuesCalls.find(
      (call: any) =>
        Array.isArray(call[0]) && call[0].every((item: any) => item.action === 'deadline.extended'),
    );
    expect(batchAuditCall).toBeDefined();
    expect(batchAuditCall[0]).toHaveLength(2);
    expect(batchAuditCall[0][0]).toEqual({
      actorId: 'instructor-1',
      action: 'deadline.extended',
      entityType: 'checkpoint',
      entityId: '10',
      details: {
        assignmentId: 1,
        studentId: 'student-1',
        extraDays: 5,
        checkpointName: 'Checkpoint 1',
        reason: 'Class-wide deadline extension due to holiday',
      },
    });
    expect(batchAuditCall[0][1]).toEqual({
      actorId: 'instructor-1',
      action: 'deadline.extended',
      entityType: 'checkpoint',
      entityId: '11',
      details: {
        assignmentId: 1,
        studentId: 'student-1',
        extraDays: 5,
        checkpointName: 'Checkpoint 2',
        reason: 'Class-wide deadline extension due to holiday',
      },
    });
  });

  it('should notify the student after bulk extension', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);

    const checkpoints = [
      { id: 10, dueDate: new Date('2026-06-15'), name: 'CP1' },
      { id: 11, dueDate: new Date('2026-07-01'), name: 'CP2' },
      { id: 12, dueDate: new Date('2026-07-15'), name: 'CP3' },
    ];

    mockDb.then
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([{ id: 1 }]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve(checkpoints).then(onfulfilled));

    await bulkExtendHandler({ data: validInput });

    const valuesCalls = vi.mocked(mockDb.values).mock.calls;
    const notificationValues = valuesCalls.find(
      (call: any) => call[0]?.type === 'deadline_extended',
    );
    expect(notificationValues).toBeDefined();
    expect(notificationValues[0].userId).toBe('student-1');
    expect(notificationValues[0].params.extraDays).toBe('5');
  });

  it('should not update assignment finalDeadline during bulk extension', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);

    const checkpoints = [{ id: 10, dueDate: new Date('2026-06-15'), name: 'CP1' }];

    mockDb.then
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([{ id: 1 }]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve(checkpoints).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ finalDeadline: new Date('2026-07-01T00:00:00Z') }]).then(onfulfilled),
      );

    await bulkExtendHandler({ data: validInput });

    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    const finalDeadlineCalls = mockDb.set.mock.calls.filter(
      (call: any[]) => 'finalDeadline' in call[0],
    );
    expect(finalDeadlineCalls).toHaveLength(0);
  });

  it('should use single bulk UPDATE for all unfinished checkpoints (PERF-3)', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);

    const checkpoints = [
      { id: 10, dueDate: new Date('2026-06-15'), name: 'CP1' },
      { id: 11, dueDate: new Date('2026-07-01'), name: 'CP2' },
      { id: 12, dueDate: new Date('2026-07-15'), name: 'CP3' },
      { id: 13, dueDate: new Date('2026-08-01'), name: 'CP4' },
      { id: 14, dueDate: new Date('2026-08-15'), name: 'CP5' },
    ];

    mockDb.then
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([{ id: 1 }]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve(checkpoints).then(onfulfilled));

    const result = await bulkExtendHandler({ data: validInput });

    expect(result).toEqual({ success: true, extendedCount: 5 });
    // Single bulk UPDATE inside transaction, not 5 individual UPDATEs
    expect(mockDb.update).toHaveBeenCalledTimes(1);
  });

  it('should use single batch INSERT for per-checkpoint audit logs (PERF-4 supplement)', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);

    const checkpoints = [
      { id: 10, dueDate: new Date('2026-06-15'), name: 'Checkpoint 1' },
      { id: 11, dueDate: new Date('2026-07-01'), name: 'Checkpoint 2' },
      { id: 12, dueDate: new Date('2026-07-15'), name: 'Checkpoint 3' },
    ];

    mockDb.then
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([{ id: 1 }]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve(checkpoints).then(onfulfilled));

    await bulkExtendHandler({ data: validInput });

    // logAuditEvent should NOT be called — batch INSERT instead
    expect(auditMod.logAuditEvent).not.toHaveBeenCalled();

    // Find the batch INSERT call (values receives an array with action 'deadline.extended')
    const valuesCalls = vi.mocked(mockDb.values).mock.calls;
    const batchAuditCall = valuesCalls.find(
      (call: any) =>
        Array.isArray(call[0]) && call[0].every((item: any) => item.action === 'deadline.extended'),
    );
    expect(batchAuditCall).toBeDefined();
    expect(batchAuditCall[0]).toHaveLength(3);
    expect(batchAuditCall[0][0]).toEqual({
      actorId: 'instructor-1',
      action: 'deadline.extended',
      entityType: 'checkpoint',
      entityId: '10',
      details: {
        assignmentId: 1,
        studentId: 'student-1',
        extraDays: 5,
        checkpointName: 'Checkpoint 1',
        reason: 'Class-wide deadline extension due to holiday',
      },
    });
  });
});
