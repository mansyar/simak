import { describe, it, expect } from 'vitest';

describe('Users schema', () => {
  it('should export users table from schema module', async () => {
    const mod = await import('@/db/schema/users');
    expect(mod).toHaveProperty('users');
  });

  it('should not export passwordResetTokens table (migrated to Better-Auth)', async () => {
    const mod = await import('@/db/schema/users');
    expect(mod).not.toHaveProperty('passwordResetTokens');
  });

  it('should have correct columns on users table', async () => {
    const { users } = await import('@/db/schema/users');

    expect(users).toHaveProperty('id');
    expect(users).toHaveProperty('name');
    expect(users).toHaveProperty('email');
    expect(users).toHaveProperty('role');
    expect(users).toHaveProperty('locale');
    expect(users).toHaveProperty('createdAt');
    expect(users).toHaveProperty('updatedAt');
    expect(users).toHaveProperty('emailVerified');
    expect(users).toHaveProperty('image');
    expect(users).toHaveProperty('deletedAt');
  });

  it('should have id as text primary key on users', async () => {
    const { users } = await import('@/db/schema/users');
    expect(users.id.dataType).toBe('string');
    expect(users.id.primary).toBe(true);
  });

  it('should have email with unique constraint on users', async () => {
    const { users } = await import('@/db/schema/users');
    expect(users.email.isUnique).toBe(true);
    expect(users.email.notNull).toBe(true);
    expect(users.email.dataType).toBe('string');
  });

  it('should have role column as not null on users', async () => {
    const { users } = await import('@/db/schema/users');
    expect(users.role.notNull).toBe(true);
    expect(users.role.dataType).toBe('string');
  });

  it('should have emailVerified column with default false on users', async () => {
    const { users } = await import('@/db/schema/users');
    expect(users).toHaveProperty('emailVerified');
    expect(users.emailVerified.default).toBe(false);
    expect(users.emailVerified.dataType).toBe('boolean');
  });

  it('should have image column as nullable text on users', async () => {
    const { users } = await import('@/db/schema/users');
    expect(users).toHaveProperty('image');
    expect(users.image.dataType).toBe('string');
  });

  it('should have twoFactorEnabled column with default false on users', async () => {
    const { users } = await import('@/db/schema/users');
    expect(users).toHaveProperty('twoFactorEnabled');
    expect(users.twoFactorEnabled.default).toBe(false);
    expect(users.twoFactorEnabled.dataType).toBe('boolean');
  });
});
