/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  completePasswordSetupHandler,
  type PasswordSetupResult,
} from '@/server/setup-password.server';

vi.mock('@tanstack/react-start', () => ({
  createServerFn: vi.fn().mockReturnValue({
    inputValidator: vi.fn().mockReturnThis(),
    handler: vi.fn().mockImplementation((fn) => fn),
  }),
}));

const { mockTx, mockDb } = vi.hoisted(() => {
  const mockTx = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
    then: vi.fn(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  };
  const mockDb = {
    transaction: vi.fn(async (callback: any) => callback(mockTx)),
  };
  return { mockTx, mockDb };
});

vi.mock('@/db/index', () => ({
  getDb: vi.fn().mockReturnValue(mockDb),
}));

vi.mock('@/db/schema/index', () => ({
  verification: { id: 'v-id', value: 'v-value', expiresAt: 'v-expires', identifier: 'v-email' },
  account: { id: 'a-id', userId: 'a-userId', accountId: 'a-accountId', providerId: 'a-providerId' },
  users: { id: 'u-id', email: 'u-email', deletedAt: 'u-deletedAt' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ eq: [a, b] })),
  and: vi.fn((...args) => ({ and: args })),
  gt: vi.fn((a, b) => ({ gt: [a, b] })),
  isNull: vi.fn((a) => ({ isNull: a })),
}));

vi.mock('better-auth/crypto', () => ({
  hashPassword: vi.fn().mockResolvedValue('hashed-password'),
}));

vi.mock('node:crypto', () => ({
  randomUUID: vi.fn().mockReturnValue('random-uuid'),
}));

describe('completePasswordSetupHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTx.then.mockImplementation((onfulfilled: any) => Promise.resolve([]).then(onfulfilled));
  });

  it('should reject invalid token or password', async () => {
    const result = await completePasswordSetupHandler({ data: { token: '', password: 'short' } });
    expect(result).toEqual({
      error: { code: 'BAD_REQUEST', message: 'Invalid token or password' },
    });
  });

  it('should atomically consume the token and complete setup', async () => {
    mockTx.then
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ id: 'verif-id', identifier: 'user@example.com' }]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ id: 'user-id' }]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled));

    const result: PasswordSetupResult = await completePasswordSetupHandler({
      data: { token: 'valid-token', password: 'securepassword' },
    });

    expect(result).toEqual({ success: true });
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
  });

  it('should return a generic error when the token is missing, expired, or already consumed', async () => {
    mockTx.then.mockImplementation((onfulfilled: any) => Promise.resolve([]).then(onfulfilled));

    const result: PasswordSetupResult = await completePasswordSetupHandler({
      data: { token: 'used-token', password: 'securepassword' },
    });

    expect(result).toEqual({ error: { code: 'NOT_FOUND', message: 'Invalid or expired token' } });
  });

  it('should return an internal error when the transaction fails', async () => {
    mockDb.transaction.mockRejectedValueOnce(new Error('database failure'));

    const result: PasswordSetupResult = await completePasswordSetupHandler({
      data: { token: 'valid-token', password: 'securepassword' },
    });

    expect(result).toEqual({ error: { code: 'INTERNAL', message: 'Internal Server Error' } });
  });

  it('should roll back and return an internal error when the user is not found', async () => {
    mockTx.then.mockImplementationOnce((onfulfilled: any) =>
      Promise.resolve([{ id: 'verif-id', identifier: 'user@example.com' }]).then(onfulfilled),
    );

    const result: PasswordSetupResult = await completePasswordSetupHandler({
      data: { token: 'valid-token', password: 'securepassword' },
    });

    expect(result).toEqual({ error: { code: 'INTERNAL', message: 'Internal Server Error' } });
  });
});
