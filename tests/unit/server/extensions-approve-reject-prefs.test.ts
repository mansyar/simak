/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { approveExtensionHandler, rejectExtensionHandler } from '@/server/extensions.server';
import * as auth from '@/server/auth';
import * as dbMod from '@/db/index';

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
    middleware: vi.fn().mockReturnThis(),
    inputValidator: vi.fn().mockReturnThis(),
    handler: vi.fn().mockImplementation((fn) => fn),
  }),
  createMiddleware: vi.fn().mockReturnValue({
    server: vi.fn().mockImplementation((fn) => fn),
  }),
}));

// ============================================================
// approveExtensionHandler - notification preference tests
// ============================================================
describe('approveExtensionHandler - notification preferences', () => {
  let mockDb: any;
  const instructorSession = {
    user: { id: 'instructor-1', role: 'instructor' as const },
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

  it('should skip notification when inApp preference is false', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);

    mockDb.then
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve(makePendingRequest()).then(onfulfilled),
      )
      .mockImplementation((onfulfilled: any) =>
        Promise.resolve([
          {
            settings: {
              notificationPrefs: { extension_approved: { inApp: false } },
            },
          },
        ]).then(onfulfilled),
      );

    await approveExtensionHandler({
      data: { requestId: 100 },
    });

    // No notification INSERT (only UPDATEs were called)
    expect(mockDb.insert).not.toHaveBeenCalled();
  });
});

// ============================================================
// rejectExtensionHandler - notification preference tests
// ============================================================
describe('rejectExtensionHandler - notification preferences', () => {
  let mockDb: any;
  const instructorSession = {
    user: { id: 'instructor-1', role: 'instructor' as const },
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

  it('should skip notification when inApp preference is false', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);

    mockDb.then
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve(makePendingRequest()).then(onfulfilled),
      )
      .mockImplementation((onfulfilled: any) =>
        Promise.resolve([
          {
            settings: {
              notificationPrefs: { extension_rejected: { inApp: false } },
            },
          },
        ]).then(onfulfilled),
      );

    await rejectExtensionHandler({
      data: { requestId: 100, resolutionReason: rejectReason },
    });

    // No notification INSERT
    expect(mockDb.insert).not.toHaveBeenCalled();
  });
});
