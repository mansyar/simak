/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  listUsersHandler,
  getUserHandler,
  updateUserHandler,
  deleteUserHandler,
  generateSetupLinkHandler,
} from '@/server/users.server';
import * as auth from '@/server/auth';
import * as authSession from '@/lib/auth-session';
import * as dbMod from '@/db/index';
import { consultations, extensionRequests, uploadIntents } from '@/db/schema';

vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn(),
}));

vi.mock('@/lib/email', () => ({
  sendInvitationEmail: vi.fn(),
}));

vi.mock('@/lib/auth-session', () => ({
  revokeUserSessions: vi.fn(),
}));

vi.mock('@/db/index', () => ({
  getDb: vi.fn(),
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

describe('User server functions - Logic & Security', () => {
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    for: vi.fn().mockReturnThis(),
    transaction: vi.fn(async (callback: any) => callback(mockDb)),
    // Simple mock for Drizzle's thenable queries
    then: vi.fn(function (onfulfilled) {
      return Promise.resolve([]).then(onfulfilled);
    }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dbMod.getDb).mockReturnValue(mockDb as any);
  });

  describe('listUsers', () => {
    it('should return users and total count', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
        user: { id: 'admin-1', role: 'superadmin' } as any,
        session: {} as any,
      });

      // Mock results for listUsers
      mockDb.then
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ id: '1', name: 'User 1' }]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ count: 1 }]).then(onfulfilled),
        );

      const result = (await listUsersHandler({
        data: { page: 1, limit: 20, search: '' },
      })) as { users: { role?: string }[]; total: number };

      expect(result.users).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should return empty if no session', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);
      const result = await listUsersHandler({ data: { page: 1, limit: 20, search: '' } });
      expect(result).toEqual({ users: [], total: 0 });
    });

    it('should return empty if student calls listUsers', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
        user: { id: 'student-1', role: 'student' } as any,
        session: {} as any,
      });
      const result = await listUsersHandler({ data: { page: 1, limit: 20, search: '' } });
      expect(result).toEqual({ users: [], total: 0 });
    });

    it('should filter to students when instructor calls listUsers', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
        user: { id: 'instructor-1', role: 'instructor' } as any,
        session: {} as any,
      });

      mockDb.then
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ id: 's1', name: 'Student 1', role: 'student' }]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ count: 1 }]).then(onfulfilled),
        );

      const result = (await listUsersHandler({
        data: { page: 1, limit: 20, search: '' },
      })) as { users: { role: string }[] };

      expect(result.users).toHaveLength(1);
      expect(result.users[0].role).toBe('student');
    });

    it('should exclude superadmin when admin calls listUsers', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
        user: { id: 'admin-1', role: 'admin' } as any,
        session: {} as any,
      });

      mockDb.then
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ id: 'u1', name: 'User 1', role: 'instructor' }]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ count: 1 }]).then(onfulfilled),
        );

      await listUsersHandler({ data: { page: 1, limit: 20, search: '' } });
      expect(mockDb.where).toHaveBeenCalled();
    });

    it('should search by name or email', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
        user: { id: 'admin-1', role: 'superadmin' } as any,
        session: {} as any,
      });

      mockDb.then
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ id: 'u1', name: 'John', email: 'john@test.com' }]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ count: 1 }]).then(onfulfilled),
        );

      const result = (await listUsersHandler({
        data: { page: 1, limit: 20, search: 'john' },
      })) as { users: unknown[]; total: number };

      expect(result.users).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('deleteUser', () => {
    it('should prevent self-deletion', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
        user: { id: 'my-id', role: 'admin' } as any,
        session: {} as any,
      });

      const result = await deleteUserHandler({ data: { id: 'my-id' } });
      expect(result).toEqual({
        error: { code: 'BAD_REQUEST', message: 'You cannot delete your own account' },
      });
    });

    it('should soft-delete another user', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
        user: { id: 'admin-1', role: 'admin' } as any,
        session: {} as any,
      });

      mockDb.then.mockImplementationOnce((fn: any) =>
        Promise.resolve([{ id: 'user-1', role: 'admin', deletedAt: null }]).then(fn),
      );

      const result = await deleteUserHandler({ data: { id: 'user-1' } });
      expect(result).toEqual({ success: true });
    });

    it('should return error if user not found or already deleted', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
        user: { id: 'admin-1', role: 'admin' } as any,
        session: {} as any,
      });

      mockDb.then.mockImplementationOnce((fn: any) => Promise.resolve([]).then(fn));

      const result = await deleteUserHandler({ data: { id: 'nonexistent' } });
      expect(result).toEqual({
        error: { code: 'NOT_FOUND', message: 'User not found or already deleted' },
      });
    });

    it('should reject unauthorized (no session)', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);
      const result = await deleteUserHandler({ data: { id: 'user-1' } });
      expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
    });

    it('should call revokeUserSessions after soft-deleting', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
        user: { id: 'admin-1', role: 'admin' } as any,
        session: {} as any,
      });

      mockDb.then.mockImplementationOnce((fn: any) =>
        Promise.resolve([{ id: 'user-1', role: 'admin', deletedAt: null }]).then(fn),
      );

      await deleteUserHandler({ data: { id: 'user-1' } });

      expect(authSession.revokeUserSessions).toHaveBeenCalledWith('user-1', 'admin-1');
    });

    it('should auto-reject pending consultations, extension requests, and revoke upload intents when deleting a student', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
        user: { id: 'admin-1', role: 'admin' } as any,
        session: {} as any,
      });

      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ id: 'user-1', role: 'student', deletedAt: null }]).then(onfulfilled),
      );

      await deleteUserHandler({ data: { id: 'user-1' } });

      expect(mockDb.transaction).toHaveBeenCalled();
      expect(mockDb.update).toHaveBeenCalledWith(consultations);
      expect(mockDb.update).toHaveBeenCalledWith(extensionRequests);
      expect(mockDb.update).toHaveBeenCalledWith(uploadIntents);
    });

    it('should block instructor deletion if they have active assignments', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
        user: { id: 'admin-1', role: 'admin' } as any,
        session: {} as any,
      });

      mockDb.then
        .mockImplementationOnce((fn: any) =>
          Promise.resolve([{ id: 'inst-1', role: 'instructor', deletedAt: null }]).then(fn),
        )
        .mockImplementationOnce((fn: any) => Promise.resolve([{ id: 1 }]).then(fn));

      const result = await deleteUserHandler({ data: { id: 'inst-1' } });
      expect(result).toEqual({
        error: {
          code: 'BAD_REQUEST',
          message: 'Instructor has active assignments. Reassign them first.',
        },
      });
    });

    it('should allow instructor deletion when no active assignments', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
        user: { id: 'admin-1', role: 'admin' } as any,
        session: {} as any,
      });

      mockDb.then
        .mockImplementationOnce((fn: any) =>
          Promise.resolve([{ id: 'inst-1', role: 'instructor', deletedAt: null }]).then(fn),
        )
        .mockImplementationOnce((fn: any) => Promise.resolve([]).then(fn));

      const result = await deleteUserHandler({ data: { id: 'inst-1' } });
      expect(result).toEqual({ success: true });
    });
  });

  describe('getUser', () => {
    it('should reject unauthorized', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);
      const result = await getUserHandler({ data: { id: 'user-1' } });
      expect(result).toBeNull();
    });

    it('should reject non-admin', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
        user: { id: 'student-1', role: 'student' } as any,
        session: {} as any,
      });
      const result = await getUserHandler({ data: { id: 'user-1' } });
      expect(result).toBeNull();
    });

    it('should return user for admin', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
        user: { id: 'admin-1', role: 'admin' } as any,
        session: {} as any,
      });
      mockDb.then.mockImplementationOnce((fn: any) =>
        Promise.resolve([
          { id: 'user-1', name: 'Test', email: 'test@test.com', role: 'student' },
        ]).then(fn),
      );

      const result = (await getUserHandler({ data: { id: 'user-1' } })) as {
        id: string;
      };
      expect(result).not.toBeNull();
      expect(result?.id).toBe('user-1');
    });

    it('should return null when admin requests a superadmin user', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
        user: { id: 'admin-1', role: 'admin' } as any,
        session: {} as any,
      });
      mockDb.then.mockImplementationOnce((fn: any) =>
        Promise.resolve([
          { id: 'super-1', name: 'Super', email: 'super@test.com', role: 'superadmin' },
        ]).then(fn),
      );

      const result = await getUserHandler({ data: { id: 'super-1' } });
      expect(result).toBeNull();
    });
  });

  describe('updateUser', () => {
    it('should reject unauthorized', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);
      const result = await updateUserHandler({
        data: { id: 'user-1', name: 'New', email: 'n@t.com' },
      });
      expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
    });

    it('should update user successfully within a transaction with FOR UPDATE lock', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
        user: { id: 'admin-1', role: 'admin' } as any,
        session: {} as any,
      });
      mockDb.then.mockImplementationOnce(
        (fn: any) => Promise.resolve([]).then(fn), // no email conflict
      );

      const result = await updateUserHandler({
        data: { id: 'user-1', name: 'Updated', email: 'u@t.com' },
      });
      expect(result).toEqual({ success: true });
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      expect(mockDb.for).toHaveBeenCalledWith(
        'update',
        expect.objectContaining({ of: expect.anything() }),
      );
    });

    it('should reject duplicate email (checked inside transaction with FOR UPDATE)', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
        user: { id: 'admin-1', role: 'admin' } as any,
        session: {} as any,
      });
      mockDb.then.mockImplementationOnce(
        (fn: any) => Promise.resolve([{ id: 'other-user' }]).then(fn), // email conflict
      );

      const result = await updateUserHandler({
        data: { id: 'user-1', name: 'Updated', email: 'existing@t.com' },
      });
      expect(result).toEqual({
        error: { code: 'BAD_REQUEST', message: 'Email already in use' },
      });
      expect(mockDb.for).toHaveBeenCalledWith(
        'update',
        expect.objectContaining({ of: expect.anything() }),
      );
    });

    it('should catch unique constraint violation (23505) and return email-in-use error', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
        user: { id: 'admin-1', role: 'admin' } as any,
        session: {} as any,
      });

      const pgError = new Error('duplicate key value violates unique constraint');
      (pgError as any).code = '23505';
      mockDb.transaction.mockRejectedValueOnce(pgError);

      const result = await updateUserHandler({
        data: { id: 'user-1', name: 'Updated', email: 'race@t.com' },
      });
      expect(result).toEqual({
        error: { code: 'BAD_REQUEST', message: 'Email already in use' },
      });
    });
  });

  describe('generateSetupLink', () => {
    it('should reject unauthorized', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);
      const result = await generateSetupLinkHandler({ data: { id: 'user-1' } });
      expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
    });

    it('should reject non-existent user', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
        user: { id: 'admin-1', role: 'admin' } as any,
        session: {} as any,
      });
      mockDb.then.mockImplementationOnce((fn: any) => Promise.resolve([]).then(fn));

      const result = await generateSetupLinkHandler({ data: { id: 'nonexistent' } });
      expect(result).toEqual({
        error: { code: 'NOT_FOUND', message: 'User not found or deleted' },
      });
    });

    it('should generate setup link for valid user', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
        user: { id: 'admin-1', role: 'admin' } as any,
        session: {} as any,
      });
      mockDb.then.mockImplementationOnce((fn: any) =>
        Promise.resolve([{ email: 'user@test.com' }]).then(fn),
      );

      const result = (await generateSetupLinkHandler({ data: { id: 'user-1' } })) as {
        url: string;
      };
      expect(result).toHaveProperty('url');
      expect(result.url).toContain('/auth/setup-password?token=');
    });

    it('should clear existing verification tokens before generating a new link', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
        user: { id: 'admin-1', role: 'admin' } as any,
        session: {} as any,
      });
      mockDb.then.mockImplementationOnce((fn: any) =>
        Promise.resolve([{ email: 'user@test.com' }]).then(fn),
      );

      const mockDeleteWhere = vi.fn().mockResolvedValue(undefined);
      const originalDelete = mockDb.delete;
      mockDb.delete = vi.fn().mockReturnValue({ where: mockDeleteWhere } as any);

      await generateSetupLinkHandler({ data: { id: 'user-1' } });

      expect(mockDb.delete).toHaveBeenCalled();
      expect(mockDeleteWhere).toHaveBeenCalled();
      mockDb.delete = originalDelete;
    });

    it('should wrap DELETE + INSERT in a single transaction', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
        user: { id: 'admin-1', role: 'admin' } as any,
        session: {} as any,
      });
      mockDb.then.mockImplementationOnce((fn: any) =>
        Promise.resolve([{ email: 'user@test.com' }]).then(fn),
      );

      await generateSetupLinkHandler({ data: { id: 'user-1' } });

      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      expect(mockDb.delete).toHaveBeenCalled();
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });
});
