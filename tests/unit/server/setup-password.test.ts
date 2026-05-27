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

describe('setup-password server function', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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
