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
    handler: vi.fn().mockImplementation((fn) => fn),
  }),
}));
// ============================================================
// approveExtensionHandler tests
// ============================================================
describe('approveExtensionHandler', () => {
  let mockDb;
  const instructorSession = {
    user: { id: 'instructor-1', role: 'instructor' },
    session: {},
  };
  const studentSession = {
    user: { id: 'student-1', role: 'student' },
    session: {},
  };
  function makePendingRequest(overrides) {
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
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      transaction: vi.fn(async (cb) => cb(mockDb)),
      then: vi.fn(function (onfulfilled) {
        return Promise.resolve([]).then(onfulfilled);
      }),
    };
    vi.mocked(dbMod.getDb).mockReturnValue(mockDb);
  });
  it('should reject if unauthorized (no session)', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);
    const result = await approveExtensionHandler({
      data: { requestId: 100 },
    });
    expect(result).toEqual({ error: 'Unauthorized' });
  });
  it('should reject if not an instructor', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession);
    const result = await approveExtensionHandler({
      data: { requestId: 100 },
    });
    expect(result).toEqual({ error: 'Unauthorized' });
  });
  it('should return error if extension request not found', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession);
    mockDb.then.mockImplementationOnce((onfulfilled) => Promise.resolve([]).then(onfulfilled));
    const result = await approveExtensionHandler({
      data: { requestId: 999 },
    });
    expect(result).toEqual({ error: 'Extension request not found' });
  });
  it('should return error if request is not in pending state', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession);
    mockDb.then.mockImplementationOnce((onfulfilled) =>
      Promise.resolve(makePendingRequest({ status: 'approved' })).then(onfulfilled),
    );
    const result = await approveExtensionHandler({
      data: { requestId: 100 },
    });
    expect(result).toEqual({ error: 'Extension request is not in pending state' });
  });
  it('should approve extension and log audit event', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession);
    mockDb.then.mockImplementationOnce((onfulfilled) =>
      Promise.resolve(makePendingRequest()).then(onfulfilled),
    );
    const result = await approveExtensionHandler({
      data: { requestId: 100 },
    });
    expect(result).toEqual({ success: true });
  });
  it('should log extension.approved audit event on approval', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession);
    mockDb.then.mockImplementationOnce((onfulfilled) =>
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
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession);
    mockDb.then.mockImplementationOnce((onfulfilled) =>
      Promise.resolve(makePendingRequest()).then(onfulfilled),
    );
    await approveExtensionHandler({
      data: { requestId: 100 },
    });
    const valuesCalls = vi.mocked(mockDb.values).mock.calls;
    const notificationValues = valuesCalls.find((call) => call[0]?.type === 'extension_approved');
    expect(notificationValues).toBeDefined();
    expect(notificationValues[0].userId).toBe('student-1');
  });
});
// ============================================================
// rejectExtensionHandler tests
// ============================================================
describe('rejectExtensionHandler', () => {
  let mockDb;
  const instructorSession = {
    user: { id: 'instructor-1', role: 'instructor' },
    session: {},
  };
  const studentSession = {
    user: { id: 'student-1', role: 'student' },
    session: {},
  };
  const rejectReason = 'This is a very long and detailed reason for rejecting extension request';
  function makePendingRequest(overrides) {
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
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      transaction: vi.fn(async (cb) => cb(mockDb)),
      then: vi.fn(function (onfulfilled) {
        return Promise.resolve([]).then(onfulfilled);
      }),
    };
    vi.mocked(dbMod.getDb).mockReturnValue(mockDb);
  });
  it('should reject if unauthorized (no session)', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);
    const result = await rejectExtensionHandler({
      data: { requestId: 100, resolutionReason: rejectReason },
    });
    expect(result).toEqual({ error: 'Unauthorized' });
  });
  it('should reject if not an instructor', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession);
    const result = await rejectExtensionHandler({
      data: { requestId: 100, resolutionReason: rejectReason },
    });
    expect(result).toEqual({ error: 'Unauthorized' });
  });
  it('should return error if extension request not found', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession);
    mockDb.then.mockImplementationOnce((onfulfilled) => Promise.resolve([]).then(onfulfilled));
    const result = await rejectExtensionHandler({
      data: { requestId: 999, resolutionReason: rejectReason },
    });
    expect(result).toEqual({ error: 'Extension request not found' });
  });
  it('should return error if request is not in pending state', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession);
    mockDb.then.mockImplementationOnce((onfulfilled) =>
      Promise.resolve(makePendingRequest({ status: 'approved' })).then(onfulfilled),
    );
    const result = await rejectExtensionHandler({
      data: { requestId: 100, resolutionReason: rejectReason },
    });
    expect(result).toEqual({ error: 'Extension request is not in pending state' });
  });
  it('should reject extension and log audit event', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession);
    mockDb.then.mockImplementationOnce((onfulfilled) =>
      Promise.resolve(makePendingRequest()).then(onfulfilled),
    );
    const result = await rejectExtensionHandler({
      data: { requestId: 100, resolutionReason: rejectReason },
    });
    expect(result).toEqual({ success: true });
  });
  it('should log extension.rejected audit event with reason', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession);
    mockDb.then.mockImplementationOnce((onfulfilled) =>
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
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession);
    mockDb.then.mockImplementationOnce((onfulfilled) =>
      Promise.resolve(makePendingRequest()).then(onfulfilled),
    );
    await rejectExtensionHandler({
      data: { requestId: 100, resolutionReason: rejectReason },
    });
    const valuesCalls = vi.mocked(mockDb.values).mock.calls;
    const notificationValues = valuesCalls.find((call) => call[0]?.type === 'extension_rejected');
    expect(notificationValues).toBeDefined();
    expect(notificationValues[0].userId).toBe('student-1');
  });
});
