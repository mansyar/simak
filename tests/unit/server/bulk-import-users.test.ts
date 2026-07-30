/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { bulkCreateUsersHandler } from '@/server/bulk-import.server';
import * as auth from '@/server/auth';
import * as dbMod from '@/db/index';
import * as email from '@/lib/email';
import * as audit from '@/lib/audit';

vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn(),
}));

vi.mock('@/db/index', () => ({
  getDb: vi.fn(),
}));

vi.mock('@/lib/email', () => ({
  sendInvitationEmail: vi.fn(),
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

describe('Bulk user import handler', () => {
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    transaction: vi.fn((fn: any) => fn(mockDb)),
    then: vi.fn(function (onfulfilled) {
      return Promise.resolve([]).then(onfulfilled);
    }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dbMod.getDb).mockReturnValue(mockDb as any);
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
      user: {
        id: 'admin-123',
        role: 'admin',
        name: 'Admin User',
        email: 'admin@test.com',
        locale: 'en',
      },
    } as any);
  });

  describe('All-valid success', () => {
    it('should create all users and return created count', async () => {
      // Mock email uniqueness check - no existing user (called twice)
      mockDb.then
        .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled))
        .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled));

      const result = (await bulkCreateUsersHandler({
        data: {
          rows: [
            { name: 'John Doe', email: 'john@test.com', role: 'student' },
            { name: 'Jane Smith', email: 'jane@test.com', role: 'instructor' },
          ],
        },
      })) as any;

      expect(result.created).toBe(2);
      expect(result.skipped).toBe(0);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Partial failure', () => {
    it('should skip invalid rows and create valid ones', async () => {
      // Batch uniqueness query returns one existing email
      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ email: 'existing@test.com' }]).then(onfulfilled),
      );

      const result = (await bulkCreateUsersHandler({
        data: {
          rows: [
            { name: 'Existing User', email: 'existing@test.com', role: 'student' },
            { name: 'New User', email: 'new@test.com', role: 'student' },
          ],
        },
      })) as any;

      expect(result.created).toBe(1);
      expect(result.skipped).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].reason).toBe('Email already in use');
    });
  });

  describe('Email uniqueness', () => {
    it('should reject emails that exist for active users (excluding soft-deleted)', async () => {
      // Mock email exists (active user found — isNull(deletedAt) filters out soft-deleted)
      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ email: 'existing@test.com' }]).then(onfulfilled),
      );

      const result = (await bulkCreateUsersHandler({
        data: {
          rows: [{ name: 'Test User', email: 'existing@test.com', role: 'student' }],
        },
      })) as any;

      expect(result.created).toBe(0);
      expect(result.skipped).toBe(1);
      expect(result.errors[0].reason).toBe('Email already in use');
    });

    it('should allow emails that match only soft-deleted users', async () => {
      // Mock: query with isNull(deletedAt) returns no rows (only soft-deleted match exists)
      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([]).then(onfulfilled),
      );

      const result = (await bulkCreateUsersHandler({
        data: {
          rows: [{ name: 'Reuse Email', email: 'deleted@test.com', role: 'student' }],
        },
      })) as any;

      expect(result.created).toBe(1);
      expect(result.skipped).toBe(0);
    });
  });

  describe('Role-permission rules', () => {
    it('should reject admin creating admin users', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
        user: { id: 'admin-123', role: 'admin' },
      } as any);

      const result = (await bulkCreateUsersHandler({
        data: {
          rows: [{ name: 'New Admin', email: 'admin@test.com', role: 'admin' }],
        },
      })) as any;

      expect(result.created).toBe(0);
      expect(result.skipped).toBe(1);
      expect(result.errors[0].reason).toContain('Admins cannot create other Admin accounts');
    });

    it('should reject superadmin creation via import', async () => {
      // Even superadmin cannot create superadmin via import
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
        user: { id: 'superadmin-123', role: 'superadmin' },
      } as any);

      const result = (await bulkCreateUsersHandler({
        data: {
          rows: [{ name: 'New SuperAdmin', email: 'super@test.com', role: 'superadmin' }],
        },
      } as any)) as any;

      expect(result.created).toBe(0);
      expect(result.skipped).toBe(1);
      expect(result.errors[0].reason).toContain('Invalid role');
    });

    it('should allow superadmin to create admin via bulk import', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
        user: { id: 'superadmin-123', role: 'superadmin' },
      } as any);

      // Mock email uniqueness check - no existing user
      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([]).then(onfulfilled),
      );

      const result = (await bulkCreateUsersHandler({
        data: {
          rows: [{ name: 'New Admin', email: 'newadmin@test.com', role: 'admin' }],
        },
      })) as any;

      expect(result.created).toBe(1);
      expect(result.skipped).toBe(0);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Row-limit', () => {
    it('should reject imports exceeding 500 rows', async () => {
      const rows = Array.from({ length: 501 }, (_, i) => ({
        name: `User ${i}`,
        email: `user${i}@test.com`,
        role: 'student' as const,
      }));

      const result = (await bulkCreateUsersHandler({
        data: { rows },
      })) as any;

      expect(result.created).toBe(0);
      expect(result.skipped).toBe(501);
      expect(result.errors[0].reason).toContain('500');
    });
  });

  describe('Invitation email enqueue', () => {
    it('should enqueue invitation email for each created user', async () => {
      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([]).then(onfulfilled),
      );

      (await bulkCreateUsersHandler({
        data: {
          rows: [{ name: 'John Doe', email: 'john@test.com', role: 'student' }],
        },
      })) as any;

      expect(email.sendInvitationEmail).toHaveBeenCalled();
    });
  });

  describe('Audit log', () => {
    it('should write user.bulk_created audit log', async () => {
      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([]).then(onfulfilled),
      );

      (await bulkCreateUsersHandler({
        data: {
          rows: [{ name: 'John Doe', email: 'john@test.com', role: 'student' }],
        },
      })) as any;

      expect(audit.logAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'user.bulk_created',
        }),
      );
    });
  });

  describe('PERF-6: Post-commit parallelization', () => {
    it('should send invitation emails concurrently via Promise.allSettled (PERF-6)', async () => {
      vi.mocked(email.sendInvitationEmail)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('SMTP down'))
        .mockResolvedValueOnce(undefined);

      const result = (await bulkCreateUsersHandler({
        data: {
          rows: [
            { name: 'User 1', email: 'user1@test.com', role: 'student' },
            { name: 'User 2', email: 'user2@test.com', role: 'student' },
            { name: 'User 3', email: 'user3@test.com', role: 'student' },
          ],
        },
      })) as any;

      expect(result.created).toBe(3);
      // All 3 emails attempted despite middle one rejecting (allSettled behavior)
      expect(email.sendInvitationEmail).toHaveBeenCalledTimes(3);
    });

    it('should use single batch INSERT for per-row audit logs (PERF-6)', async () => {
      const result = (await bulkCreateUsersHandler({
        data: {
          rows: [
            { name: 'User 1', email: 'user1@test.com', role: 'student' },
            { name: 'User 2', email: 'user2@test.com', role: 'student' },
            { name: 'User 3', email: 'user3@test.com', role: 'student' },
          ],
        },
      })) as any;

      expect(result.created).toBe(3);
      // Per-row audits are batched into a single db.insert(auditLog).values([...])
      // Only the batch audit (user.bulk_created) goes through logAuditEvent
      expect(audit.logAuditEvent).toHaveBeenCalledTimes(1);
      expect(audit.logAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'user.bulk_created' }),
      );
      // Verify batch insert was called with an array of audit entries
      expect(mockDb.values).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ action: 'user.created' })]),
      );
    });
  });

  describe('Session/role verification', () => {
    it('should reject unauthenticated requests', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);

      const result = await bulkCreateUsersHandler({
        data: {
          rows: [{ name: 'John Doe', email: 'john@test.com', role: 'student' }],
        },
      });

      expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
    });

    it('should reject non-admin/instructor roles', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
        user: { id: 'student-123', role: 'student' },
      } as any);

      const result = await bulkCreateUsersHandler({
        data: {
          rows: [{ name: 'John Doe', email: 'john@test.com', role: 'student' }],
        },
      });

      expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
    });
  });
});
