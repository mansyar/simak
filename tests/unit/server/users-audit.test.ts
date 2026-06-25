import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as auth from '@/server/auth';
import * as email from '@/lib/email';
import * as dbMod from '@/db/index';
import * as auditMod from '@/lib/audit';

vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn(),
}));

vi.mock('@/lib/email', () => ({
  sendInvitationEmail: vi.fn(),
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

describe('User handlers audit logging', () => {
  const mockDb: any = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    then: vi.fn(function (onfulfilled) {
      return Promise.resolve([]).then(onfulfilled);
    }),
  };

  mockDb.transaction = vi.fn().mockImplementation(async (callback: any) => callback(mockDb));

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dbMod.getDb).mockReturnValue(mockDb as any);
  });

  describe('createUserHandler', () => {
    it('should write user.created audit entry on successful creation', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
        user: { id: 'admin-1', role: 'admin', locale: 'en' } as any,
        session: {} as any,
      });

      // Mock email uniqueness check: return undefined (no user found)
      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([]).then(onfulfilled),
      );

      const { createUserHandler } = await import('@/server/users.server');
      await createUserHandler({
        data: { name: 'Test User', email: 'test@example.com', role: 'student' },
      });

      expect(auditMod.logAuditEvent).toHaveBeenCalledWith({
        actorId: 'admin-1',
        action: 'user.created',
        entityType: 'user',
        entityId: expect.any(String),
        details: { role: 'student', email: 'test@example.com' },
      });
    });
  });

  describe('deleteUserHandler', () => {
    it('should write user.deleted audit entry on successful soft-delete', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
        user: { id: 'admin-1', role: 'admin' } as any,
        session: {} as any,
      });

      const { deleteUserHandler } = await import('@/server/users.server');
      await deleteUserHandler({
        data: { id: 'user-to-delete' },
      });

      expect(auditMod.logAuditEvent).toHaveBeenCalledWith({
        actorId: 'admin-1',
        action: 'user.deleted',
        entityType: 'user',
        entityId: 'user-to-delete',
        details: undefined,
      });
    });
  });
});
