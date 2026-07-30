/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  approveExtensionHandler,
  rejectExtensionHandler,
  bulkExtendHandler,
} from '@/server/extensions-extras.server';
import { requestExtensionHandler } from '@/server/extensions.server';
import * as auth from '@/server/auth';
import * as dbMod from '@/db/index';
import { enqueueEmail, resolveEmailRecipient } from '@/lib/email';
import {
  buildExtensionApprovedHtml,
  buildExtensionRejectedHtml,
  buildExtensionRequestedHtml,
} from '@/lib/email-templates';
import { logger } from '@/lib/logger';

vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn(),
}));

vi.mock('@/db/index', () => ({
  getDb: vi.fn(),
}));

vi.mock('@/lib/audit', () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/email', () => ({
  enqueueEmail: vi.fn().mockResolvedValue(undefined),
  resolveEmailRecipient: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/email-templates', () => ({
  buildExtensionApprovedHtml: vi.fn().mockReturnValue('<html>approved body</html>'),
  buildExtensionRejectedHtml: vi.fn().mockReturnValue('<html>rejected body</html>'),
  buildExtensionRequestedHtml: vi.fn().mockReturnValue('<html>requested body</html>'),
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn() },
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

function createMockDb() {
  const mockTx = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    for: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    then: vi.fn((onfulfilled: any) => Promise.resolve([]).then(onfulfilled)),
  };
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    for: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    transaction: vi.fn((cb: (tx: any) => Promise<any>) => cb(mockTx)),
    then: vi.fn((onfulfilled: any) => Promise.resolve([]).then(onfulfilled)),
  };
  return { mockDb, mockTx };
}

describe('Extension email enqueue — approveExtensionHandler', () => {
  let mockDb: any;
  let mockTx: any;
  const instructorSession = {
    user: { id: 'instructor-1', name: 'Prof. Smith', role: 'instructor' as const },
    session: {} as any,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    ({ mockDb, mockTx } = createMockDb());
    vi.mocked(dbMod.getDb).mockReturnValue(mockDb as any);
  });

  function setupApprovedRequest() {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
    mockTx.then.mockImplementationOnce((onfulfilled: any) =>
      Promise.resolve([
        {
          id: 1,
          status: 'pending',
          extensionDays: 5,
          studentId: 'student-1',
          checkpointId: null,
          assignmentId: 101,
          instructorId: 'instructor-1',
        },
      ]).then(onfulfilled),
    );
    mockDb.then.mockImplementationOnce((onfulfilled: any) =>
      Promise.resolve([{ title: 'Thesis 2026' }]).then(onfulfilled),
    );
  }

  it('should enqueue extension_approved email to student', async () => {
    setupApprovedRequest();
    vi.mocked(resolveEmailRecipient).mockResolvedValue({
      email: 'student@test.com',
      locale: 'en',
    });
    vi.mocked(buildExtensionApprovedHtml).mockReturnValue('<html>approved body</html>');

    const result = await approveExtensionHandler({ data: { requestId: 1 } });

    expect(result).toEqual({ success: true });
    expect(resolveEmailRecipient).toHaveBeenCalledWith('student-1');
    expect(buildExtensionApprovedHtml).toHaveBeenCalledWith(
      expect.objectContaining({
        instructorName: 'Prof. Smith',
        assignmentName: 'Thesis 2026',
        assignmentId: 101,
        extensionDays: 5,
        locale: 'en',
      }),
    );
    expect(enqueueEmail).toHaveBeenCalledWith({
      recipientEmail: 'student@test.com',
      subject: '[SIMAK] Extension Approved',
      bodyHtml: '<html>approved body</html>',
      templateType: 'extension_approved',
    });
  });

  it('should succeed even when enqueueEmail throws (advisory-only)', async () => {
    setupApprovedRequest();
    vi.mocked(resolveEmailRecipient).mockResolvedValue({
      email: 'student@test.com',
      locale: 'en',
    });
    vi.mocked(enqueueEmail).mockRejectedValueOnce(new Error('email service down'));

    const result = await approveExtensionHandler({ data: { requestId: 1 } });

    expect(result).toEqual({ success: true });
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'advisory_failed' }),
    );
  });
});

describe('Extension email enqueue — rejectExtensionHandler', () => {
  let mockDb: any;
  let mockTx: any;
  const instructorSession = {
    user: { id: 'instructor-1', name: 'Prof. Smith', role: 'instructor' as const },
    session: {} as any,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    ({ mockDb, mockTx } = createMockDb());
    vi.mocked(dbMod.getDb).mockReturnValue(mockDb as any);
  });

  function setupRejectedRequest() {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
    mockTx.then.mockImplementationOnce((onfulfilled: any) =>
      Promise.resolve([
        {
          id: 1,
          status: 'pending',
          extensionDays: 5,
          studentId: 'student-1',
          assignmentId: 101,
          instructorId: 'instructor-1',
        },
      ]).then(onfulfilled),
    );
    mockDb.then.mockImplementationOnce((onfulfilled: any) =>
      Promise.resolve([{ title: 'Thesis 2026' }]).then(onfulfilled),
    );
  }

  it('should enqueue extension_rejected email to student', async () => {
    setupRejectedRequest();
    vi.mocked(resolveEmailRecipient).mockResolvedValue({
      email: 'student@test.com',
      locale: 'en',
    });
    vi.mocked(buildExtensionRejectedHtml).mockReturnValue('<html>rejected body</html>');

    const result = await rejectExtensionHandler({
      data: { requestId: 1, resolutionReason: 'Not enough justification' },
    });

    expect(result).toEqual({ success: true });
    expect(resolveEmailRecipient).toHaveBeenCalledWith('student-1');
    expect(buildExtensionRejectedHtml).toHaveBeenCalledWith(
      expect.objectContaining({
        instructorName: 'Prof. Smith',
        assignmentName: 'Thesis 2026',
        assignmentId: 101,
        rejectionReason: 'Not enough justification',
        locale: 'en',
      }),
    );
    expect(enqueueEmail).toHaveBeenCalledWith({
      recipientEmail: 'student@test.com',
      subject: '[SIMAK] Extension Rejected',
      bodyHtml: '<html>rejected body</html>',
      templateType: 'extension_rejected',
    });
  });

  it('should skip email when student is soft-deleted or has no verified email', async () => {
    setupRejectedRequest();
    vi.mocked(resolveEmailRecipient).mockResolvedValue(null);

    const result = await rejectExtensionHandler({
      data: { requestId: 1, resolutionReason: 'No' },
    });

    expect(result).toEqual({ success: true });
    expect(enqueueEmail).not.toHaveBeenCalled();
  });
});

describe('Extension email enqueue — requestExtensionHandler', () => {
  let mockDb: any;
  let mockTx: any;
  const studentSession = {
    user: { id: 'student-1', name: 'Alice', role: 'student' as const },
    session: {} as any,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    ({ mockDb, mockTx } = createMockDb());
    // requestExtensionHandler uses mockDb as both db and tx
    mockDb.transaction = vi.fn(async (cb: (tx: any) => Promise<any>) => cb(mockDb));
    vi.mocked(dbMod.getDb).mockReturnValue(mockDb as any);
  });

  function setupSuccessfulRequest() {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);
    mockDb.then
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([{ id: 1 }]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([
          { maxExtensionDays: 7, maxTotalExtensions: 3, instructorId: 'instructor-1' },
        ]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ dueDate: new Date('2026-06-15') }]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([{ id: 1 }]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ count: 0 }]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ title: 'Thesis 2026' }]).then(onfulfilled),
      );
    mockDb.returning.mockResolvedValue([{ id: 100 }]);
  }

  it('should enqueue extension_requested email to instructor', async () => {
    setupSuccessfulRequest();
    vi.mocked(resolveEmailRecipient).mockResolvedValue({
      email: 'instructor@test.com',
      locale: 'en',
    });
    vi.mocked(buildExtensionRequestedHtml).mockReturnValue('<html>requested body</html>');

    const result = await requestExtensionHandler({
      data: {
        assignmentId: 1,
        category: 'personal',
        reason: 'Need more time',
        extensionDays: 5,
        checkpointId: 10,
      },
    });

    expect(result).toHaveProperty('extensionRequest');
    expect(resolveEmailRecipient).toHaveBeenCalledWith('instructor-1');
    expect(buildExtensionRequestedHtml).toHaveBeenCalledWith(
      expect.objectContaining({
        studentName: 'Alice',
        assignmentName: 'Thesis 2026',
        assignmentId: 1,
        category: 'personal',
        durationRequested: 5,
        locale: 'en',
      }),
    );
    expect(enqueueEmail).toHaveBeenCalledWith({
      recipientEmail: 'instructor@test.com',
      subject: '[SIMAK] Extension Requested',
      bodyHtml: '<html>requested body</html>',
      templateType: 'extension_requested',
    });
  });

  it('should localize email subject for Indonesian instructor', async () => {
    setupSuccessfulRequest();
    vi.mocked(resolveEmailRecipient).mockResolvedValue({
      email: 'instructor@test.com',
      locale: 'id',
    });

    await requestExtensionHandler({
      data: {
        assignmentId: 1,
        category: 'personal',
        reason: 'Need more time',
        extensionDays: 5,
        checkpointId: 10,
      },
    });

    expect(enqueueEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: '[SIMAK] Perpanjangan Diminta',
      }),
    );
  });

  it('should succeed even when enqueueEmail throws (advisory-only)', async () => {
    setupSuccessfulRequest();
    vi.mocked(resolveEmailRecipient).mockResolvedValue({
      email: 'instructor@test.com',
      locale: 'en',
    });
    vi.mocked(enqueueEmail).mockRejectedValueOnce(new Error('email service down'));

    const result = await requestExtensionHandler({
      data: {
        assignmentId: 1,
        category: 'personal',
        reason: 'Need more time',
        extensionDays: 5,
        checkpointId: 10,
      },
    });

    expect(result).toHaveProperty('extensionRequest');
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'advisory_failed' }),
    );
  });
});

describe('Extension email enqueue — bulkExtendHandler', () => {
  let mockDb: any;
  let mockTx: any;
  const instructorSession = {
    user: { id: 'instructor-1', name: 'Prof. Smith', role: 'instructor' as const },
    session: {} as any,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    ({ mockDb, mockTx } = createMockDb());
    vi.mocked(dbMod.getDb).mockReturnValue(mockDb as any);
  });

  function setupBulkExtend() {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
    mockDb.then
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([{ id: 1 }]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([
          { id: 100, dueDate: new Date('2026-06-15'), name: 'Chapter 1' },
          { id: 101, dueDate: new Date('2026-06-20'), name: 'Chapter 2' },
        ]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ title: 'Thesis 2026' }]).then(onfulfilled),
      );
  }

  it('should enqueue extension_approved email to student on bulk extend', async () => {
    setupBulkExtend();
    vi.mocked(resolveEmailRecipient).mockResolvedValue({
      email: 'student@test.com',
      locale: 'en',
    });
    vi.mocked(buildExtensionApprovedHtml).mockReturnValue('<html>approved body</html>');

    const result = await bulkExtendHandler({
      data: { assignmentId: 1, studentId: 'student-1', extraDays: 3, reason: 'Medical leave' },
    });

    expect(result).toEqual({ success: true, extendedCount: 2 });
    expect(resolveEmailRecipient).toHaveBeenCalledWith('student-1');
    expect(buildExtensionApprovedHtml).toHaveBeenCalledWith(
      expect.objectContaining({
        instructorName: 'Prof. Smith',
        assignmentName: 'Thesis 2026',
        assignmentId: 1,
        extensionDays: 3,
        locale: 'en',
      }),
    );
    expect(enqueueEmail).toHaveBeenCalledWith({
      recipientEmail: 'student@test.com',
      subject: '[SIMAK] Extension Approved',
      bodyHtml: '<html>approved body</html>',
      templateType: 'extension_approved',
    });
  });

  it('should localize email subject for Indonesian student', async () => {
    setupBulkExtend();
    vi.mocked(resolveEmailRecipient).mockResolvedValue({
      email: 'student@test.com',
      locale: 'id',
    });

    await bulkExtendHandler({
      data: { assignmentId: 1, studentId: 'student-1', extraDays: 3, reason: 'Medical leave' },
    });

    expect(enqueueEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: '[SIMAK] Perpanjangan Disetujui',
      }),
    );
  });

  it('should succeed even when enqueueEmail throws (advisory-only)', async () => {
    setupBulkExtend();
    vi.mocked(resolveEmailRecipient).mockResolvedValue({
      email: 'student@test.com',
      locale: 'en',
    });
    vi.mocked(enqueueEmail).mockRejectedValueOnce(new Error('email service down'));

    const result = await bulkExtendHandler({
      data: { assignmentId: 1, studentId: 'student-1', extraDays: 3, reason: 'Medical leave' },
    });

    expect(result).toEqual({ success: true, extendedCount: 2 });
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'advisory_failed' }),
    );
  });

  it('should skip email when student is soft-deleted or has no verified email', async () => {
    setupBulkExtend();
    vi.mocked(resolveEmailRecipient).mockResolvedValue(null);

    const result = await bulkExtendHandler({
      data: { assignmentId: 1, studentId: 'student-1', extraDays: 3, reason: 'Medical leave' },
    });

    expect(result).toEqual({ success: true, extendedCount: 2 });
    expect(enqueueEmail).not.toHaveBeenCalled();
  });
});
