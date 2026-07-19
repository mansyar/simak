/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { approveExtensionHandler, rejectExtensionHandler } from '@/server/extensions.server';
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

// ============================================================
// approveExtensionHandler tests
// ============================================================
describe('approveExtensionHandler', () => {
  let mockDb: any;
  const instructorSession = {
    user: { id: 'instructor-1', role: 'instructor' as const },
    session: {} as any,
  };
  const studentSession = {
    user: { id: 'student-1', role: 'student' as const },
    session: {} as any,
  };

  function makePendingRequest(overrides?: Record<string, unknown>) {
    return [
      {
        id: 100,
        status: 'pending',
        extensionDays: 5,
        studentId: 'student-1',
        checkpointId: 10,
        assignmentId: 1,
        instructorId: 'instructor-1',
        ...overrides,
      },
    ];
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
      for: vi.fn().mockReturnThis(),
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

    const result = await approveExtensionHandler({
      data: { requestId: 100 },
    });
    expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
  });

  it('should reject if not an instructor', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);

    const result = await approveExtensionHandler({
      data: { requestId: 100 },
    });
    expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
  });

  it('should return error if extension request not found', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);

    mockDb.then.mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled));

    const result = await approveExtensionHandler({
      data: { requestId: 999 },
    });
    expect(result).toEqual({
      error: { code: 'NOT_FOUND', message: 'Extension request not found' },
    });
  });

  it('should return already-processed error if status changed after lock', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);

    mockDb.then.mockImplementationOnce((onfulfilled: any) =>
      Promise.resolve(makePendingRequest({ status: 'approved' })).then(onfulfilled),
    );

    const result = await approveExtensionHandler({
      data: { requestId: 100 },
    });
    expect(result).toEqual({
      error: { code: 'BAD_REQUEST', message: 'Extension request has already been processed' },
    });
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('should approve extension within transaction with FOR UPDATE lock', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);

    mockDb.then.mockImplementationOnce((onfulfilled: any) =>
      Promise.resolve(makePendingRequest()).then(onfulfilled),
    );

    const result = await approveExtensionHandler({ data: { requestId: 100 } });

    expect(result).toEqual({ success: true });
    expect(mockDb.transaction).toHaveBeenCalled();
    expect(mockDb.for).toHaveBeenCalledWith(
      'update',
      expect.objectContaining({ of: expect.anything() }),
    );
  });

  it('should approve extension and log audit event', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);

    mockDb.then.mockImplementationOnce((onfulfilled: any) =>
      Promise.resolve(makePendingRequest()).then(onfulfilled),
    );

    const result = await approveExtensionHandler({
      data: { requestId: 100 },
    });

    expect(result).toEqual({ success: true });
  });

  it('should log extension.approved audit event on approval', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);

    mockDb.then.mockImplementationOnce((onfulfilled: any) =>
      Promise.resolve(makePendingRequest()).then(onfulfilled),
    );

    await approveExtensionHandler({
      data: { requestId: 100, resolutionReason: 'Approved due to valid reasons' },
    });

    expect(auditMod.logAuditEvent).toHaveBeenCalledWith({
      actorId: 'instructor-1',
      action: 'extension.approved',
      entityType: 'extension_request',
      entityId: '100',
      details: {
        assignmentId: 1,
        studentId: 'student-1',
        extensionDays: 5,
        resolutionReason: 'Approved due to valid reasons',
      },
    });
  });

  it('should notify student on approval', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);

    mockDb.then.mockImplementationOnce((onfulfilled: any) =>
      Promise.resolve(makePendingRequest()).then(onfulfilled),
    );

    await approveExtensionHandler({
      data: { requestId: 100 },
    });

    const valuesCalls = vi.mocked(mockDb.values).mock.calls;
    const notificationValues = valuesCalls.find(
      (call: any) => call[0]?.type === 'extension_approved',
    );
    expect(notificationValues).toBeDefined();
    expect(notificationValues[0].userId).toBe('student-1');
  });

  it('should not update assignment finalDeadline when approving extension', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);

    mockDb.then
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve(makePendingRequest()).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ order: 1, dueDate: new Date('2026-06-01T00:00:00Z') }]).then(
          onfulfilled,
        ),
      )
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ finalDeadline: new Date('2026-07-01T00:00:00Z') }]).then(onfulfilled),
      );

    await approveExtensionHandler({
      data: { requestId: 100, resolutionReason: 'Approved' },
    });

    const finalDeadlineCalls = mockDb.set.mock.calls.filter(
      (call: any[]) => 'finalDeadline' in call[0],
    );
    expect(finalDeadlineCalls).toHaveLength(0);
  });

  it('should lock checkpoints with FOR UPDATE when calculating extension adjustment', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);

    mockDb.then
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve(makePendingRequest()).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ order: 1, dueDate: new Date('2026-06-01T00:00:00Z') }]).then(
          onfulfilled,
        ),
      )
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled));

    await approveExtensionHandler({ data: { requestId: 100 } });

    // FOR UPDATE called for: extensionRequests, target checkpoint (no subsequent SELECT)
    expect(mockDb.for).toHaveBeenCalledTimes(2);
  });

  it('should use single bulk UPDATE for subsequent checkpoints in extension adjustment (PERF-2)', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);

    mockDb.then
      // SELECT extension request
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve(makePendingRequest()).then(onfulfilled),
      )
      // UPDATE extension request status
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled))
      // SELECT target checkpoint
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ order: 1, dueDate: new Date('2026-06-01T00:00:00Z') }]).then(
          onfulfilled,
        ),
      )
      // UPDATE affected checkpoint
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled))
      // SELECT subsequent checkpoints (old code) / bulk UPDATE (new code)
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([
          { id: 101, dueDate: new Date('2026-06-10T00:00:00Z') },
          { id: 102, dueDate: new Date('2026-06-20T00:00:00Z') },
          { id: 103, dueDate: new Date('2026-06-30T00:00:00Z') },
        ]).then(onfulfilled),
      )
      // INSERT notification
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled));

    await approveExtensionHandler({ data: { requestId: 100 } });

    // With bulk UPDATE: 3 UPDATE calls (extensionRequests + affected + 1 bulk)
    // Old code would make 6 UPDATE calls (extensionRequests + affected + 3 individual)
    expect(mockDb.update).toHaveBeenCalledTimes(3);
  });
});

// ============================================================
// rejectExtensionHandler tests
// ============================================================
describe('rejectExtensionHandler', () => {
  let mockDb: any;
  const instructorSession = {
    user: { id: 'instructor-1', role: 'instructor' as const },
    session: {} as any,
  };
  const studentSession = {
    user: { id: 'student-1', role: 'student' as const },
    session: {} as any,
  };

  const rejectReason = 'This is a very long and detailed reason for rejecting extension request';

  function makePendingRequest(overrides?: Record<string, unknown>) {
    return [
      {
        id: 100,
        status: 'pending',
        extensionDays: 5,
        studentId: 'student-1',
        assignmentId: 1,
        instructorId: 'instructor-1',
        ...overrides,
      },
    ];
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
      for: vi.fn().mockReturnThis(),
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

    const result = await rejectExtensionHandler({
      data: { requestId: 100, resolutionReason: rejectReason },
    });
    expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
  });

  it('should reject if not an instructor', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);

    const result = await rejectExtensionHandler({
      data: { requestId: 100, resolutionReason: rejectReason },
    });
    expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
  });

  it('should return error if extension request not found', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);

    mockDb.then.mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled));

    const result = await rejectExtensionHandler({
      data: { requestId: 999, resolutionReason: rejectReason },
    });
    expect(result).toEqual({
      error: { code: 'NOT_FOUND', message: 'Extension request not found' },
    });
  });

  it('should return already-processed error if status changed after lock', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);

    mockDb.then.mockImplementationOnce((onfulfilled: any) =>
      Promise.resolve(makePendingRequest({ status: 'rejected' })).then(onfulfilled),
    );

    const result = await rejectExtensionHandler({
      data: { requestId: 100, resolutionReason: rejectReason },
    });
    expect(result).toEqual({
      error: { code: 'BAD_REQUEST', message: 'Extension request has already been processed' },
    });
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('should reject extension within transaction with FOR UPDATE lock', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);

    mockDb.then.mockImplementationOnce((onfulfilled: any) =>
      Promise.resolve(makePendingRequest()).then(onfulfilled),
    );

    const result = await rejectExtensionHandler({
      data: { requestId: 100, resolutionReason: rejectReason },
    });

    expect(result).toEqual({ success: true });
    expect(mockDb.transaction).toHaveBeenCalled();
    expect(mockDb.for).toHaveBeenCalledWith(
      'update',
      expect.objectContaining({ of: expect.anything() }),
    );
  });

  it('should reject extension and log audit event', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);

    mockDb.then.mockImplementationOnce((onfulfilled: any) =>
      Promise.resolve(makePendingRequest()).then(onfulfilled),
    );

    const result = await rejectExtensionHandler({
      data: { requestId: 100, resolutionReason: rejectReason },
    });

    expect(result).toEqual({ success: true });
  });

  it('should log extension.rejected audit event with reason', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);

    mockDb.then.mockImplementationOnce((onfulfilled: any) =>
      Promise.resolve(makePendingRequest()).then(onfulfilled),
    );

    await rejectExtensionHandler({
      data: { requestId: 100, resolutionReason: rejectReason },
    });

    expect(auditMod.logAuditEvent).toHaveBeenCalledWith({
      actorId: 'instructor-1',
      action: 'extension.rejected',
      entityType: 'extension_request',
      entityId: '100',
      details: {
        assignmentId: 1,
        studentId: 'student-1',
        extensionDays: 5,
        resolutionReason: rejectReason,
      },
    });
  });

  it('should notify student on rejection with reason', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);

    mockDb.then.mockImplementationOnce((onfulfilled: any) =>
      Promise.resolve(makePendingRequest()).then(onfulfilled),
    );

    await rejectExtensionHandler({
      data: { requestId: 100, resolutionReason: rejectReason },
    });

    const valuesCalls = vi.mocked(mockDb.values).mock.calls;
    const notificationValues = valuesCalls.find(
      (call: any) => call[0]?.type === 'extension_rejected',
    );
    expect(notificationValues).toBeDefined();
    expect(notificationValues[0].userId).toBe('student-1');
  });
});
