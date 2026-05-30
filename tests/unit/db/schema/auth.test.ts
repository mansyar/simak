import { describe, it, expect } from 'vitest';

describe('Auth schema exports', () => {
  it('should export session table', async () => {
    const mod = await import('@/db/schema/auth');
    expect(mod).toHaveProperty('session');
  });

  it('should export account table', async () => {
    const mod = await import('@/db/schema/auth');
    expect(mod).toHaveProperty('account');
  });

  it('should export verification table', async () => {
    const mod = await import('@/db/schema/auth');
    expect(mod).toHaveProperty('verification');
  });

  it('should export twoFactor table', async () => {
    const mod = await import('@/db/schema/auth');
    expect(mod).toHaveProperty('twoFactor');
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

  it('should have unique not-null token', async () => {
    const { session } = await import('@/db/schema/auth');
    expect(session.token.isUnique).toBe(true);
    expect(session.token.notNull).toBe(true);
    expect(session.token.dataType).toBe('string');
  });

  it('should have not-null userId referencing users', async () => {
    const { session } = await import('@/db/schema/auth');
    expect(session.userId.notNull).toBe(true);
    expect(session.userId.dataType).toBe('string');
  });

  it('should have not-null expiresAt', async () => {
    const { session } = await import('@/db/schema/auth');
    expect(session.expiresAt.notNull).toBe(true);
    expect(session.expiresAt.dataType).toBe('date');
  });

  it('should have nullable ipAddress and userAgent', async () => {
    const { session } = await import('@/db/schema/auth');
    expect(session.ipAddress.dataType).toBe('string');
    expect(session.userAgent.dataType).toBe('string');
  });

  it('should have createdAt and updatedAt with defaultNow', async () => {
    const { session } = await import('@/db/schema/auth');
    expect(session.createdAt).toHaveProperty('default');
    expect(session.updatedAt).toHaveProperty('default');
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

  it('should have not-null userId referencing users', async () => {
    const { account } = await import('@/db/schema/auth');
    expect(account.userId.notNull).toBe(true);
    expect(account.userId.dataType).toBe('string');
  });

  it('should have not-null accountId and providerId', async () => {
    const { account } = await import('@/db/schema/auth');
    expect(account.accountId.notNull).toBe(true);
    expect(account.accountId.dataType).toBe('string');
    expect(account.providerId.notNull).toBe(true);
    expect(account.providerId.dataType).toBe('string');
  });

  it('should have nullable password and token fields', async () => {
    const { account } = await import('@/db/schema/auth');
    expect(account.password.dataType).toBe('string');
    expect(account.accessToken.dataType).toBe('string');
    expect(account.refreshToken.dataType).toBe('string');
    expect(account.scope.dataType).toBe('string');
    expect(account.idToken.dataType).toBe('string');
  });

  it('should have nullable timestamp fields', async () => {
    const { account } = await import('@/db/schema/auth');
    expect(account.accessTokenExpiresAt.dataType).toBe('date');
    expect(account.refreshTokenExpiresAt.dataType).toBe('date');
  });

  it('should have createdAt and updatedAt with defaultNow', async () => {
    const { account } = await import('@/db/schema/auth');
    expect(account.createdAt).toHaveProperty('default');
    expect(account.updatedAt).toHaveProperty('default');
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

  it('should have not-null identifier', async () => {
    const { verification } = await import('@/db/schema/auth');
    expect(verification.identifier.notNull).toBe(true);
    expect(verification.identifier.dataType).toBe('string');
  });

  it('should have not-null value', async () => {
    const { verification } = await import('@/db/schema/auth');
    expect(verification.value.notNull).toBe(true);
    expect(verification.value.dataType).toBe('string');
  });

  it('should have not-null expiresAt', async () => {
    const { verification } = await import('@/db/schema/auth');
    expect(verification.expiresAt.notNull).toBe(true);
    expect(verification.expiresAt.dataType).toBe('date');
  });

  it('should have createdAt and updatedAt with defaultNow', async () => {
    const { verification } = await import('@/db/schema/auth');
    expect(verification.createdAt).toHaveProperty('default');
    expect(verification.updatedAt).toHaveProperty('default');
  });
});

describe('TwoFactor table', () => {
  it('should have correct columns', async () => {
    const { twoFactor } = await import('@/db/schema/auth');
    expect(twoFactor).toHaveProperty('id');
    expect(twoFactor).toHaveProperty('secret');
    expect(twoFactor).toHaveProperty('backupCodes');
    expect(twoFactor).toHaveProperty('verified');
    expect(twoFactor).toHaveProperty('userId');
  });

  it('should have id as text primary key', async () => {
    const { twoFactor } = await import('@/db/schema/auth');
    expect(twoFactor.id.dataType).toBe('string');
    expect(twoFactor.id.primary).toBe(true);
  });

  it('should have secret as not-null text', async () => {
    const { twoFactor } = await import('@/db/schema/auth');
    expect(twoFactor.secret.notNull).toBe(true);
    expect(twoFactor.secret.dataType).toBe('string');
  });

  it('should have backupCodes as not-null text', async () => {
    const { twoFactor } = await import('@/db/schema/auth');
    expect(twoFactor.backupCodes.notNull).toBe(true);
    expect(twoFactor.backupCodes.dataType).toBe('string');
  });

  it('should have verified as boolean defaulting to true', async () => {
    const { twoFactor } = await import('@/db/schema/auth');
    expect(twoFactor.verified.dataType).toBe('boolean');
    expect(twoFactor.verified.default).toBe(true);
  });

  it('should have not-null userId referencing users', async () => {
    const { twoFactor } = await import('@/db/schema/auth');
    expect(twoFactor.userId.notNull).toBe(true);
    expect(twoFactor.userId.dataType).toBe('string');
  });

  it('should have verified defaulting to true', async () => {
    const { twoFactor } = await import('@/db/schema/auth');
    expect(twoFactor.verified.default).toBe(true);
  });
});

describe('Cross-table relations', () => {
  it('should import users table for foreign key references', async () => {
    const { users } = await import('@/db/schema/users');
    expect(users).toHaveProperty('id');
    expect(users.id.dataType).toBe('string');
    expect(users.id.primary).toBe(true);
  });

  it('should have session userId column that can reference users.id', async () => {
    const { session } = await import('@/db/schema/auth');
    const { users } = await import('@/db/schema/users');
    expect(session.userId.dataType).toBe(users.id.dataType);
  });

  it('should have account userId column that can reference users.id', async () => {
    const { account } = await import('@/db/schema/auth');
    const { users } = await import('@/db/schema/users');
    expect(account.userId.dataType).toBe(users.id.dataType);
  });

  it('should have twoFactor userId column that can reference users.id', async () => {
    const { twoFactor } = await import('@/db/schema/auth');
    const { users } = await import('@/db/schema/users');
    expect(twoFactor.userId.dataType).toBe(users.id.dataType);
  });
});
