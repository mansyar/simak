/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import {
  CreateUserSchema,
  UpdateUserSchema,
  ListUsersSchema,
} from '@/server/users';
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
    then: vi.fn(function(onfulfilled) {
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
      const result = await createUserHandler({ data: { name: 'Test', email: 'test@example.com', role: 'student' } });
      expect(result).toEqual({ error: 'Unauthorized' });
    });

    it('should fail if student tries to create user', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
        user: { id: '1', role: 'student' } as any,
        session: {} as any
      });
      const result = await createUserHandler({ data: { name: 'Test', email: 'test@example.com', role: 'student' } });
      expect(result).toEqual({ error: 'Unauthorized' });
    });

    it('should allow admin to create instructor', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
        user: { id: 'admin-1', role: 'admin' } as any,
        session: {} as any
      });
      
      // Mock email uniqueness check: return undefined (no user found)
      mockDb.then.mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled));

      const result = await createUserHandler({ data: { name: 'New Instructor', email: 'inst@example.com', role: 'instructor' } });
      
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('emailSent');
      expect(email.sendInvitationEmail).toHaveBeenCalled();
    });

    it('should prevent admin from creating superadmin', async () => {
      const result = CreateUserSchema.safeParse({
        name: 'Bad',
        email: 'bad@example.com',
        role: 'superadmin'
      });
      expect(result.success).toBe(false);
    });

    it('should prevent admin from creating another admin', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
        user: { id: 'admin-1', role: 'admin' } as any,
        session: {} as any
      });

      const result = await createUserHandler({ data: { name: 'Other Admin', email: 'admin2@example.com', role: 'admin' } });
      expect(result).toEqual({ error: 'Admins cannot create other Admin accounts' });
    });
  });

  describe('listUsers', () => {
    it('should return users and total count', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
        user: { id: 'admin-1', role: 'superadmin' } as any,
        session: {} as any
      });

      // Mock results for listUsers
      mockDb.then
        .mockImplementationOnce((onfulfilled: any) => Promise.resolve([{ id: '1', name: 'User 1' }]).then(onfulfilled))
        .mockImplementationOnce((onfulfilled: any) => Promise.resolve([{ count: 1 }]).then(onfulfilled));

      const result = await listUsersHandler({ data: { page: 1, limit: 20, search: '' } });
      
      expect(result.users).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('deleteUser', () => {
    it('should prevent self-deletion', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
        user: { id: 'my-id', role: 'admin' } as any,
        session: {} as any
      });

      const result = await deleteUserHandler({ data: { id: 'my-id' } });
      expect(result).toEqual({ error: 'You cannot delete your own account' });
    });
  });
});
