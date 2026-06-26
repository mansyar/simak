/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import { bulkCreateUsersHandler } from '@/server/bulk-import.server';
import * as auth from '@/server/auth';
import * as dbMod from '@/db/index';
import * as email from '@/lib/email';
import * as audit from '@/lib/audit';
import { users, verification } from '@/db/schema/index';

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
    inputValidator: vi.fn().mockReturnThis(),
    handler: vi.fn().mockImplementation((fn) => fn),
  }),
}));

describe('Bulk user import handler — batching', () => {
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

  describe('Batch email uniqueness check', () => {
    it('should use a single batched query to fetch existing emails, not per-row queries', async () => {
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
      expect(mockDb.from).toHaveBeenCalledTimes(1);
      expect(mockDb.from).toHaveBeenCalledWith(users);
      expect(mockDb.where).toHaveBeenCalledTimes(1);
    });

    it('should skip rows with existing emails and add them to errors', async () => {
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

    it('should skip intra-batch duplicate emails (same email submitted twice)', async () => {
      const result = (await bulkCreateUsersHandler({
        data: {
          rows: [
            { name: 'First Dup', email: 'dup@test.com', role: 'student' },
            { name: 'Second Dup', email: 'dup@test.com', role: 'student' },
          ],
        },
      })) as any;

      expect(result.created).toBe(1);
      expect(result.skipped).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].reason).toBe('Email already in use');
      expect(result.errors[0].email).toBe('dup@test.com');

      // The duplicate must not reach the batch insert — only one user staged
      const usersValuesCall = mockDb.values.mock.calls.find(
        (call) => Array.isArray(call[0]) && call[0][0]?.email === 'dup@test.com',
      );
      expect(usersValuesCall?.[0]).toHaveLength(1);
    });

    it('should skip invalid-role rows before the batched uniqueness check', async () => {
      const result = (await bulkCreateUsersHandler({
        data: {
          rows: [
            { name: 'Invalid Role', email: 'invalid-role@test.com', role: 'superadmin' as any },
            { name: 'Valid User', email: 'valid@test.com', role: 'student' },
          ],
        },
      })) as any;

      expect(result.created).toBe(1);
      expect(result.skipped).toBe(1);
      expect(result.errors[0].reason).toContain('Invalid role');
      expect(mockDb.from).toHaveBeenCalledTimes(1);
      expect(mockDb.where).toHaveBeenCalledTimes(1);
    });

    it('should preserve { created, skipped, errors } return shape', async () => {
      const result = (await bulkCreateUsersHandler({
        data: { rows: [{ name: 'John Doe', email: 'john@test.com', role: 'student' }] },
      })) as any;

      expect(result).toEqual(
        expect.objectContaining({
          created: expect.any(Number),
          skipped: expect.any(Number),
          errors: expect.any(Array),
        }),
      );
    });
  });

  describe('Batch user + verification inserts', () => {
    it('should insert all valid users + verification tokens in a single transaction', async () => {
      const result = (await bulkCreateUsersHandler({
        data: {
          rows: [
            { name: 'John Doe', email: 'john@test.com', role: 'student' },
            { name: 'Jane Smith', email: 'jane@test.com', role: 'instructor' },
          ],
        },
      })) as any;

      expect(result.created).toBe(2);
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      expect(mockDb.insert).toHaveBeenCalledWith(users);
      expect(mockDb.insert).toHaveBeenCalledWith(verification);
    });

    it('should use one batched .values([...]) call per table for 100 rows', async () => {
      const rows = Array.from({ length: 100 }, (_, i) => ({
        name: `User ${i}`,
        email: `user${i}@test.com`,
        role: 'student' as const,
      }));

      (await bulkCreateUsersHandler({ data: { rows } })) as any;

      const userInsertCalls = mockDb.insert.mock.calls.filter((call) => call[0] === users);
      const verificationInsertCalls = mockDb.insert.mock.calls.filter(
        (call) => call[0] === verification,
      );

      expect(userInsertCalls).toHaveLength(1);
      expect(verificationInsertCalls).toHaveLength(1);

      const usersValuesCall = mockDb.values.mock.calls.find(
        (call) => Array.isArray(call[0]) && call[0][0]?.email?.startsWith('user'),
      );
      expect(usersValuesCall?.[0]).toHaveLength(100);
    });

    it('should rollback and return internal error when the batch transaction fails', async () => {
      vi.mocked(dbMod.getDb).mockReturnValue({
        ...mockDb,
        transaction: vi.fn().mockRejectedValueOnce(new Error('Transaction failed')),
      } as any);

      const result = (await bulkCreateUsersHandler({
        data: { rows: [{ name: 'John Doe', email: 'john@test.com', role: 'student' }] },
      })) as any;

      expect(result).toEqual(
        expect.objectContaining({
          error: { code: 'INTERNAL', message: 'Internal Server Error' },
        }),
      );
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('should generate unique UUIDs per user before the batch insert', async () => {
      const uuids = new Set<string>();
      const originalRandomUUID = crypto.randomUUID;
      vi.spyOn(crypto, 'randomUUID').mockImplementation(() => {
        const id = originalRandomUUID();
        uuids.add(id);
        return id;
      });

      (await bulkCreateUsersHandler({
        data: {
          rows: [
            { name: 'John Doe', email: 'john@test.com', role: 'student' },
            { name: 'Jane Smith', email: 'jane@test.com', role: 'student' },
          ],
        },
      })) as any;

      expect(uuids.size).toBeGreaterThanOrEqual(4); // 2 userIds + 2 tokens + verification ids
      vi.restoreAllMocks();
    });

    it('should preserve { created, skipped, errors } return shape after batch insert', async () => {
      const result = (await bulkCreateUsersHandler({
        data: { rows: [{ name: 'John Doe', email: 'john@test.com', role: 'student' }] },
      })) as any;

      expect(result).toEqual(
        expect.objectContaining({
          created: expect.any(Number),
          skipped: expect.any(Number),
          errors: expect.any(Array),
        }),
      );
    });
  });

  describe('Decouple invitation emails from request cycle', () => {
    it('should not call sendInvitationEmail per-row inside the create loop (before transaction)', async () => {
      const order: string[] = [];
      vi.mocked(email.sendInvitationEmail).mockImplementation(async () => {
        order.push('email');
      });
      mockDb.transaction = vi.fn(async (fn: any) => {
        order.push('transaction');
        return fn(mockDb);
      });

      (await bulkCreateUsersHandler({
        data: {
          rows: [
            { name: 'John Doe', email: 'john@test.com', role: 'student' },
            { name: 'Jane Smith', email: 'jane@test.com', role: 'instructor' },
          ],
        },
      })) as any;

      const transactionIndex = order.indexOf('transaction');
      expect(transactionIndex).toBeGreaterThanOrEqual(0);
      order.forEach((event, index) => {
        if (event === 'email') {
          expect(index).toBeGreaterThan(transactionIndex);
        }
      });
    });

    it('should enqueue all invitation emails after the DB transaction commits', async () => {
      (await bulkCreateUsersHandler({
        data: {
          rows: [
            { name: 'John Doe', email: 'john@test.com', role: 'student' },
            { name: 'Jane Smith', email: 'jane@test.com', role: 'instructor' },
          ],
        },
      })) as any;

      expect(email.sendInvitationEmail).toHaveBeenCalledTimes(2);
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    });

    it('should keep email failures non-fatal', async () => {
      vi.mocked(email.sendInvitationEmail).mockRejectedValueOnce(new Error('SMTP down'));

      const result = (await bulkCreateUsersHandler({
        data: { rows: [{ name: 'John Doe', email: 'john@test.com', role: 'student' }] },
      })) as any;

      expect(result.created).toBe(1);
      expect(result.error).toBeUndefined();
    });

    it('should send correct email payloads for each created user', async () => {
      (await bulkCreateUsersHandler({
        data: {
          rows: [
            { name: 'John Doe', email: 'john@test.com', role: 'student' },
            { name: 'Jane Smith', email: 'jane@test.com', role: 'instructor' },
          ],
        },
      })) as any;

      expect(email.sendInvitationEmail).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'john@test.com', name: 'John Doe' }),
      );
      expect(email.sendInvitationEmail).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'jane@test.com', name: 'Jane Smith' }),
      );

      const tokens = vi
        .mocked(email.sendInvitationEmail)
        .mock.calls.map((call) => (call[0] as { token: string }).token);
      expect(new Set(tokens).size).toBe(2);
    });
  });
});
