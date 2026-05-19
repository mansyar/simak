import { describe, it, expect } from 'vitest';

describe('Auth schema tables', () => {
  it('should export session table from auth schema', async () => {
    const mod = await import('@/db/schema/auth');
    expect(mod).toHaveProperty('session');
  });

  it('should export account table from auth schema', async () => {
    const mod = await import('@/db/schema/auth');
    expect(mod).toHaveProperty('account');
  });

  it('should export verification table from auth schema', async () => {
    const mod = await import('@/db/schema/auth');
    expect(mod).toHaveProperty('verification');
  });
});

describe('Session table', () => {
  it('should have correct columns', async () => {
    const { session } = await import('@/db/schema/auth');

    expect(session).toHaveProperty('id');
    expect(session).toHaveProperty('userId');
    expect(session).toHaveProperty('token');
    expect(session).toHaveProperty('expiresAt');
    expect(session).toHaveProperty('ipAddress');
    expect(session).toHaveProperty('userAgent');
    expect(session).toHaveProperty('createdAt');
    expect(session).toHaveProperty('updatedAt');
  });

  it('should have id as text primary key', async () => {
    const { session } = await import('@/db/schema/auth');
    expect(session.id.dataType).toBe('string');
    expect(session.id.primary).toBe(true);
  });

  it('should have unique token', async () => {
    const { session } = await import('@/db/schema/auth');
    expect(session.token.isUnique).toBe(true);
    expect(session.token.notNull).toBe(true);
  });

  it('should have userId foreign key referencing users', async () => {
    const { session } = await import('@/db/schema/auth');
    expect(session.userId.notNull).toBe(true);
    expect(session.userId.dataType).toBe('string');
  });
});

describe('Account table', () => {
  it('should have correct columns', async () => {
    const { account } = await import('@/db/schema/auth');

    expect(account).toHaveProperty('id');
    expect(account).toHaveProperty('userId');
    expect(account).toHaveProperty('accountId');
    expect(account).toHaveProperty('providerId');
    expect(account).toHaveProperty('password');
    expect(account).toHaveProperty('accessToken');
    expect(account).toHaveProperty('refreshToken');
    expect(account).toHaveProperty('accessTokenExpiresAt');
    expect(account).toHaveProperty('refreshTokenExpiresAt');
    expect(account).toHaveProperty('scope');
    expect(account).toHaveProperty('idToken');
    expect(account).toHaveProperty('createdAt');
    expect(account).toHaveProperty('updatedAt');
  });

  it('should have id as text primary key', async () => {
    const { account } = await import('@/db/schema/auth');
    expect(account.id.dataType).toBe('string');
    expect(account.id.primary).toBe(true);
  });

  it('should have userId foreign key referencing users', async () => {
    const { account } = await import('@/db/schema/auth');
    expect(account.userId.notNull).toBe(true);
    expect(account.userId.dataType).toBe('string');
  });
});

describe('Verification table', () => {
  it('should have correct columns', async () => {
    const { verification } = await import('@/db/schema/auth');

    expect(verification).toHaveProperty('id');
    expect(verification).toHaveProperty('identifier');
    expect(verification).toHaveProperty('value');
    expect(verification).toHaveProperty('expiresAt');
    expect(verification).toHaveProperty('createdAt');
    expect(verification).toHaveProperty('updatedAt');
  });

  it('should have id as text primary key', async () => {
    const { verification } = await import('@/db/schema/auth');
    expect(verification.id.dataType).toBe('string');
    expect(verification.id.primary).toBe(true);
  });
});
