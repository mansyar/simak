/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateUserSchema } from '@/server/users';
import {
  createUserHandler,
  listUsersHandler,
  getUserHandler,
  updateUserHandler,
  deleteUserHandler,
  generateSetupLinkHandler,
} from '@/server/users.server';
import * as auth from '@/server/auth';
import * as email from '@/lib/email';
import * as dbMod from '@/db/index';

vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn(),
}));

vi.mock('@/lib/email', () => ({
  sendInvitationEmail: vi.fn(),
}));

vi.mock('@/db/index', () => ({
  getDb: vi.fn(),
}));

vi.mock('@tanstack/react-start', () => ({
  createServerFn: vi.fn().mockReturnValue({
    handler: vi.fn().mockImplementation((fn) => fn),
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
    // Simple mock for Drizzle's thenable queries
    then: vi.fn(function (onfulfilled) {
      return Promise.resolve([]).then(onfulfilled);
    }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dbMod.getDb).mockReturnValue(mockDb as any);
  });

  describe('createUser', () => {
    it('should fail if unauthorized', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);
      const result = await createUserHandler({
        data: { name: 'Test', email: 'test@example.com', role: 'student' },
      });
      expect(result).toEqual({ error: 'Unauthorized' });
    });

    it('should fail if student tries to create user', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
        user: { id: '1', role: 'student' } as any,
        session: {} as any,
      });
      const result = await createUserHandler({
        data: { name: 'Test', email: 'test@example.com', role: 'student' },
      });
      expect(result).toEqual({ error: 'Unauthorized' });
    });

    it('should allow admin to create instructor', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
        user: { id: 'admin-1', role: 'admin' } as any,
        session: {} as any,
      });

      // Mock email uniqueness check: return undefined (no user found)
      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([]).then(onfulfilled),
      );

      const result = await createUserHandler({
        data: { name: 'New Instructor', email: 'inst@example.com', role: 'instructor' },
      });

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('emailSent');
      expect(email.sendInvitationEmail).toHaveBeenCalled();
    });

    it('should prevent admin from creating superadmin', async () => {
      const result = CreateUserSchema.safeParse({
        name: 'Bad',
        email: 'bad@example.com',
        role: 'superadmin',
      });
      expect(result.success).toBe(false);
    });

    it('should prevent admin from creating another admin', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
        user: { id: 'admin-1', role: 'admin' } as any,
        session: {} as any,
      });

      const result = await createUserHandler({
        data: { name: 'Other Admin', email: 'admin2@example.com', role: 'admin' },
      });
      expect(result).toEqual({ error: 'Admins cannot create other Admin accounts' });
    });

    it('should reject duplicate email', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
        user: { id: 'admin-1', role: 'admin' } as any,
        session: {} as any,
      });

      // Mock email uniqueness check: return existing user
      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ id: 'existing-user' }]).then(onfulfilled),
      );

      const result = await createUserHandler({
        data: { name: 'Duplicate', email: 'existing@test.com', role: 'student' },
      });
      expect(result).toEqual({ error: 'Email already in use' });
    });
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

      const result = await listUsersHandler({ data: { page: 1, limit: 20, search: '' } });

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

      const result = await listUsersHandler({ data: { page: 1, limit: 20, search: '' } });
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

      const result = await listUsersHandler({ data: { page: 1, limit: 20, search: 'john' } });
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
      expect(result).toEqual({ error: 'You cannot delete your own account' });
    });

    it('should soft-delete another user', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
        user: { id: 'admin-1', role: 'admin' } as any,
        session: {} as any,
      });

      const result = await deleteUserHandler({ data: { id: 'user-1' } });
      expect(result).toEqual({ success: true });
    });

    it('should reject unauthorized (no session)', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);
      const result = await deleteUserHandler({ data: { id: 'user-1' } });
      expect(result).toEqual({ error: 'Unauthorized' });
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

      const result = await getUserHandler({ data: { id: 'user-1' } });
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
      expect(result).toEqual({ error: 'Unauthorized' });
    });

    it('should update user successfully', async () => {
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
    });

    it('should reject duplicate email', async () => {
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
      expect(result).toEqual({ error: 'Email already in use' });
    });
  });

  describe('generateSetupLink', () => {
    it('should reject unauthorized', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);
      const result = await generateSetupLinkHandler({ data: { id: 'user-1' } });
      expect(result).toEqual({ error: 'Unauthorized' });
    });

    it('should reject non-existent user', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
        user: { id: 'admin-1', role: 'admin' } as any,
        session: {} as any,
      });
      mockDb.then.mockImplementationOnce((fn: any) => Promise.resolve([]).then(fn));

      const result = await generateSetupLinkHandler({ data: { id: 'nonexistent' } });
      expect(result).toEqual({ error: 'User not found or deleted' });
    });

    it('should generate setup link for valid user', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
        user: { id: 'admin-1', role: 'admin' } as any,
        session: {} as any,
      });
      mockDb.then.mockImplementationOnce((fn: any) =>
        Promise.resolve([{ email: 'user@test.com' }]).then(fn),
      );

      const result = await generateSetupLinkHandler({ data: { id: 'user-1' } });
      expect(result).toHaveProperty('url');
      expect(result?.url).toContain('/auth/setup-password?token=');
    });
  });
});
