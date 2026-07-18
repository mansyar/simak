/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requestExtensionHandler } from '@/server/extensions.server';
import * as auth from '@/server/auth';
import * as dbMod from '@/db/index';
import { isServerError } from '@/lib/errors';

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

describe('requestExtensionHandler', () => {
  let mockDb: any;
  const studentSession = {
    user: { id: 'student-1', role: 'student' as const },
    session: {} as any,
  };
  const instructorSession = {
    user: { id: 'instructor-1', role: 'instructor' as const },
    session: {} as any,
  };

  const validInput = {
    assignmentId: 1,
    category: 'personal' as const,
    reason: 'I need more time to complete this assignment due to personal matters',
    extensionDays: 5,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {
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
      then: vi.fn(function (onfulfilled: any) {
        return Promise.resolve([]).then(onfulfilled);
      }),
      transaction: vi.fn(async (callback: (tx: any) => any) => {
        return callback(mockDb);
      }),
    };
    vi.mocked(dbMod.getDb).mockReturnValue(mockDb as any);
  });

  it('should reject if unauthorized (no session)', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);

    const result = await requestExtensionHandler({ data: validInput });
    expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
  });

  it('should reject if not a student', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);

    const result = await requestExtensionHandler({ data: validInput });
    expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
  });

  it('should reject if student is not enrolled in the assignment', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);

    mockDb.then.mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled));

    const result = await requestExtensionHandler({ data: validInput });
    expect(result).toEqual({ error: { code: 'NOT_FOUND', message: 'Assignment not found' } });
  });

  it('should reject if extensionDays exceeds max_extension_days cap', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);

    mockDb.then
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([{ id: 1 }]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([
          { maxExtensionDays: 3, maxTotalExtensions: 3, instructorId: 'instructor-1' },
        ]).then(onfulfilled),
      );

    const result = await requestExtensionHandler({
      data: { ...validInput, extensionDays: 5 },
    });
    expect(result).toEqual({
      error: { code: 'BAD_REQUEST', message: 'Extension days cannot exceed 3 for this assignment' },
    });
  });

  it('should reject if max total extensions exceeded (count checked inside transaction)', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);

    mockDb.then
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([{ id: 1 }]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([
          { maxExtensionDays: 7, maxTotalExtensions: 2, instructorId: 'instructor-1' },
        ]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ id: 10, dueDate: new Date('2026-06-15'), order: 1 }]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ dueDate: new Date('2026-06-15') }]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([{ id: 1 }]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ count: 2 }]).then(onfulfilled),
      );

    const result = await requestExtensionHandler({ data: validInput });
    expect(result).toEqual({
      error: {
        code: 'BAD_REQUEST',
        message: 'Maximum 2 extension(s) allowed for this assignment. You have used 2.',
      },
    });
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    expect(mockDb.for).toHaveBeenCalledWith(
      'update',
      expect.objectContaining({ of: expect.anything() }),
    );
  });

  it('should create extension request successfully with default checkpoint', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);

    mockDb.then
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([{ id: 1 }]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([
          { maxExtensionDays: 7, maxTotalExtensions: 3, instructorId: 'instructor-1' },
        ]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ id: 10, dueDate: new Date('2026-06-15'), order: 1 }]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ dueDate: new Date('2026-06-15') }]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([{ id: 1 }]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ count: 0 }]).then(onfulfilled),
      );

    mockDb.returning.mockResolvedValue([{ id: 100 }]);

    const result = await requestExtensionHandler({ data: validInput });
    expect(result).toHaveProperty('extensionRequest');
    if (isServerError(result)) throw new Error(result.error.message);
    expect(result.extensionRequest!.id).toBe(100);
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    expect(mockDb.insert).toHaveBeenCalledTimes(2);
    expect(mockDb.for).toHaveBeenCalledWith(
      'update',
      expect.objectContaining({ of: expect.anything() }),
    );
  });

  it('should create extension request with specific checkpointId', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);

    mockDb.then
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([{ id: 1 }]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([
          { maxExtensionDays: 7, maxTotalExtensions: 3, instructorId: 'instructor-1' },
        ]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ id: 10, dueDate: new Date('2026-06-15') }]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([{ id: 1 }]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ count: 0 }]).then(onfulfilled),
      );

    mockDb.returning.mockResolvedValue([{ id: 101 }]);

    const result = await requestExtensionHandler({
      data: { ...validInput, checkpointId: 10 },
    });
    expect(result).toHaveProperty('extensionRequest');
    if (isServerError(result)) throw new Error(result.error.message);
    expect(result.extensionRequest!.id).toBe(101);
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    expect(mockDb.insert).toHaveBeenCalledTimes(2);
  });

  it('should return error if target checkpoint not found', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);

    mockDb.then
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([{ id: 1 }]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([
          { maxExtensionDays: 7, maxTotalExtensions: 3, instructorId: 'instructor-1' },
        ]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled));

    const result = await requestExtensionHandler({
      data: { ...validInput, checkpointId: 15 },
    });
    expect(result).toEqual({ error: { code: 'NOT_FOUND', message: 'Checkpoint not found' } });
  });

  it('should notify instructor via notification insert', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);

    mockDb.then
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([{ id: 1 }]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([
          { maxExtensionDays: 7, maxTotalExtensions: 3, instructorId: 'instructor-1' },
        ]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ id: 10, dueDate: new Date('2026-06-15'), order: 1 }]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ dueDate: new Date('2026-06-15') }]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([{ id: 1 }]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ count: 0 }]).then(onfulfilled),
      );

    mockDb.returning.mockResolvedValue([{ id: 100 }]);

    await requestExtensionHandler({ data: validInput });

    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    expect(mockDb.insert).toHaveBeenCalledTimes(2);
    const valuesCalls = vi.mocked(mockDb.values).mock.calls;
    const notificationValues = valuesCalls[1][0];
    expect(notificationValues.userId).toBe('instructor-1');
    expect(notificationValues.type).toBe('extension_requested');
  });

  it('should roll back extension request when notification insert fails', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);

    mockDb.then
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([{ id: 1 }]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([
          { maxExtensionDays: 7, maxTotalExtensions: 3, instructorId: 'instructor-1' },
        ]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ id: 10, dueDate: new Date('2026-06-15'), order: 1 }]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ dueDate: new Date('2026-06-15') }]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([{ id: 1 }]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ count: 0 }]).then(onfulfilled),
      );

    mockDb.returning.mockResolvedValue([{ id: 100 }]);
    mockDb.insert.mockReturnValueOnce(mockDb).mockImplementationOnce(() => {
      throw new Error('notification insert failed');
    });

    const result = await requestExtensionHandler({ data: validInput });

    expect(result).toEqual({
      error: {
        code: 'INTERNAL',
        message: 'Internal Server Error',
      },
    });
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    expect(mockDb.insert).toHaveBeenCalledTimes(2);
    await expect(mockDb.transaction.mock.results[0].value).rejects.toThrow(
      'notification insert failed',
    );
  });
});
