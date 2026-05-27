/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @tanstack/react-start
vi.mock('@tanstack/react-start', () => ({
  createServerFn: vi.fn().mockReturnValue({
    handler: vi.fn().mockImplementation((fn) => fn),
  }),
}));

// Mock better-auth/crypto
vi.mock('better-auth/crypto', () => ({
  hashPassword: vi.fn().mockResolvedValue('hashed-password-123'),
}));

// Mock node:crypto
vi.mock('node:crypto', () => ({
  default: {
    randomUUID: vi.fn().mockReturnValue('mock-uuid-123'),
  },
}));

// Mock db index
vi.mock('@/db/index', () => ({
  getDb: vi.fn(),
}));

// Mock drizzle-orm
vi.mock('drizzle-orm', () => ({
  eq: vi.fn().mockImplementation((col, val) => ({ type: 'eq', col, val })),
  and: vi.fn().mockImplementation((...args) => ({ type: 'and', args })),
  gt: vi.fn().mockImplementation((col, val) => ({ type: 'gt', col, val })),
  isNull: vi.fn().mockImplementation((col) => ({ type: 'isNull', col })),
}));

// Mock db schema
vi.mock('@/db/schema/index', () => ({
  verification: {
    id: 'verification_id',
    value: 'verification_value',
    identifier: 'verification_identifier',
    expiresAt: 'verification_expiresAt',
  },
  account: {
    id: 'account_id',
    userId: 'account_userId',
    accountId: 'account_accountId',
    providerId: 'account_providerId',
    password: 'account_password',
  },
  users: {
    id: 'users_id',
    email: 'users_email',
    emailVerified: 'users_emailVerified',
    deletedAt: 'users_deletedAt',
  },
}));

import { getDb } from '@/db/index';
import { hashPassword } from 'better-auth/crypto';

// Helper to call the handler directly
async function callHandler(data: { token?: string; password?: string }) {
  // Import the module fresh each time to get the handler
  const { completePasswordSetup } = await import('@/server/setup-password');
  return (completePasswordSetup as any)({ data });
}

// Build a chainable mock query that supports .select().from().where().limit(1).then(fn)
function makeQuery(rows: any[]) {
  const thenable = {
    then: (fn: (v: any[]) => any) => Promise.resolve(rows).then(fn),
    catch: (fn: (v: any) => any) => Promise.resolve(rows).catch(fn),
  };
  const query = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnValue(thenable),
    // For mutation chains: update/set/where, insert/values, delete/where
    set: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  };
  return query;
}

// Build a counter-based mock that returns different rows for each sequential query
function buildCounterMock(resultSets: any[][]) {
  let callCount = 0;
  return {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockImplementation(() => {
      const idx = Math.min(callCount, resultSets.length - 1);
      callCount++;
      const rows = resultSets[idx];
      return {
        then: (fn: (v: any[]) => any) => Promise.resolve(rows).then(fn),
      };
    }),
    set: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  };
}

describe('setup-password server function', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Validation', () => {
    it('should return error when token is missing', async () => {
      const result = await callHandler({ token: '', password: 'password123' });
      expect(result).toEqual({ error: 'Invalid token or password' });
    });

    it('should return error when password is missing', async () => {
      const result = await callHandler({ token: 'valid-token', password: '' });
      expect(result).toEqual({ error: 'Invalid token or password' });
    });

    it('should return error when password is too short', async () => {
      const result = await callHandler({ token: 'valid-token', password: 'short' });
      expect(result).toEqual({ error: 'Invalid token or password' });
    });

    it('should return error when both token and password are missing', async () => {
      const result = await callHandler({ token: '', password: '' });
      expect(result).toEqual({ error: 'Invalid token or password' });
    });

    it('should return error when token is undefined', async () => {
      const result = await callHandler({ password: 'password123' });
      expect(result).toEqual({ error: 'Invalid token or password' });
    });

    it('should return error when password is undefined', async () => {
      const result = await callHandler({ token: 'valid-token' });
      expect(result).toEqual({ error: 'Invalid token or password' });
    });
  });

  describe('Handler flow', () => {
    it('should return error when verification record not found', async () => {
      const mockDb = makeQuery([]);
      vi.mocked(getDb).mockReturnValue(mockDb as any);

      const result = await callHandler({ token: 'invalid-token', password: 'password123' });

      expect(result).toEqual({ error: 'Invalid or expired token' });
    });

    it('should return error when user not found', async () => {
      const verificationRecord = {
        id: 'v-1',
        identifier: 'user@test.com',
        value: 'valid-token',
        expiresAt: new Date(),
      };

      const mockDb = buildCounterMock([
        [verificationRecord], // query 1: verification lookup
        [], // query 2: user lookup returns empty
      ]);
      vi.mocked(getDb).mockReturnValue(mockDb as any);

      const result = await callHandler({ token: 'valid-token', password: 'password123' });

      expect(result).toEqual({ error: 'User not found' });
    });

    it('should insert account and set password for new user', async () => {
      const verificationRecord = {
        id: 'v-1',
        identifier: 'user@test.com',
        value: 'valid-token',
        expiresAt: new Date(),
      };
      const userRecord = { id: 'user-1' };

      const mockDb = buildCounterMock([
        [verificationRecord], // query 1: verification lookup
        [userRecord], // query 2: user lookup
        [], // query 3: account check (empty = no existing)
      ]);
      vi.mocked(getDb).mockReturnValue(mockDb as any);

      const result = await callHandler({ token: 'valid-token', password: 'password123456' });

      expect(result).toEqual({ success: true });
      expect(hashPassword).toHaveBeenCalledWith('password123456');
    });

    it('should update existing account password and return success', async () => {
      const verificationRecord = {
        id: 'v-1',
        identifier: 'user@test.com',
        value: 'valid-token',
        expiresAt: new Date('2026-12-31'),
      };
      const userRecord = { id: 'user-1' };
      const accountRecord = { id: 'acct-1' };

      let queryCount = 0;
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockImplementation(() => ({
          then: (fn: (v: any[]) => any) => {
            queryCount++;
            if (queryCount === 1) return Promise.resolve([verificationRecord]).then(fn);
            if (queryCount === 2) return Promise.resolve([userRecord]).then(fn);
            if (queryCount === 3) return Promise.resolve([accountRecord]).then(fn);
            return Promise.resolve([]).then(fn);
          },
        })),
        set: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
      } as any;
      vi.mocked(getDb).mockReturnValue(mockQuery);

      const result = await callHandler({ token: 'valid-token', password: 'password123456' });

      expect(result).toEqual({ success: true });
    });
  });
});
