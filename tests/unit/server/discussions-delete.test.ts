/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deleteOwnMessageHandler } from '@/server/discussions.server';
import * as auth from '@/server/auth';
import * as dbMod from '@/db/index';

vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn(),
}));

vi.mock('@/db/index', () => ({
  getDb: vi.fn(),
}));

vi.mock('@tanstack/react-start', () => ({
  createServerFn: vi.fn().mockReturnValue({
    inputValidator: vi.fn().mockReturnThis(),
    handler: vi.fn().mockImplementation((fn) => fn),
  }),
}));

describe('deleteOwnMessageHandler', () => {
  let mockDb: any;

  const studentSession = {
    user: { id: 'student-1', role: 'student' as const },
    session: {} as any,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      then: vi.fn((onfulfilled: any) => Promise.resolve([]).then(onfulfilled)),
    };
    vi.mocked(dbMod.getDb).mockReturnValue(mockDb as any);
  });

  it('should reject if unauthorized', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);

    const result = await deleteOwnMessageHandler({ data: { messageId: 1 } });
    expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
  });

  it('should reject non-student/instructor roles', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
      user: { id: 'admin-1', role: 'admin' as const },
      session: {} as any,
    } as any);

    const result = await deleteOwnMessageHandler({ data: { messageId: 1 } });
    expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
  });

  it('should reject if message not found', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);

    // Message lookup returns empty
    mockDb.then.mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled));

    const result = await deleteOwnMessageHandler({ data: { messageId: 999 } });
    expect(result).toEqual({
      error: { code: 'NOT_FOUND', message: 'Message not found' },
    });
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('should reject if user is not the author', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);

    // Message lookup returns message authored by someone else
    mockDb.then.mockImplementationOnce((onfulfilled: any) =>
      Promise.resolve([{ userId: 'student-2', createdAt: new Date() }]).then(onfulfilled),
    );

    const result = await deleteOwnMessageHandler({ data: { messageId: 1 } });
    expect(result).toEqual({
      error: { code: 'FORBIDDEN', message: 'You can only delete your own messages' },
    });
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('should reject if deletion window expired (15 minutes)', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);

    // Message created 20 minutes ago (outside 15-min window)
    const oldDate = new Date(Date.now() - 20 * 60 * 1000);
    mockDb.then.mockImplementationOnce((onfulfilled: any) =>
      Promise.resolve([{ userId: 'student-1', createdAt: oldDate }]).then(onfulfilled),
    );

    const result = await deleteOwnMessageHandler({ data: { messageId: 1 } });
    expect(result).toEqual({
      error: { code: 'FORBIDDEN', message: 'Deletion window expired' },
    });
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('should soft-delete message and return success when within deletion window', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);

    // Message created 5 minutes ago (within 15-min window)
    const recentDate = new Date(Date.now() - 5 * 60 * 1000);
    // [0] message lookup
    mockDb.then.mockImplementationOnce((onfulfilled: any) =>
      Promise.resolve([{ userId: 'student-1', createdAt: recentDate }]).then(onfulfilled),
    );
    // [1] update — resolves (no returning)
    mockDb.then.mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled));

    const result = (await deleteOwnMessageHandler({ data: { messageId: 42 } })) as any;

    expect(result.success).toBe(true);
    expect(mockDb.update).toHaveBeenCalledTimes(1);
    expect(mockDb.set).toHaveBeenCalledWith(
      expect.objectContaining({ deletedAt: expect.any(Date) }),
    );
  });
});
