import { describe, it, expect } from 'vitest';

describe('Users schema', () => {
  it('should export users table from schema module', async () => {
    const mod = await import('@/db/schema/users');
    expect(mod).toHaveProperty('users');
    expect(mod).toHaveProperty('passwordResetTokens');
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
});

describe('Password reset tokens schema', () => {
  it('should have correct columns on passwordResetTokens table', async () => {
    const { passwordResetTokens } = await import('@/db/schema/users');

    expect(passwordResetTokens).toHaveProperty('id');
    expect(passwordResetTokens).toHaveProperty('userId');
    expect(passwordResetTokens).toHaveProperty('token');
    expect(passwordResetTokens).toHaveProperty('expiresAt');
    expect(passwordResetTokens).toHaveProperty('used');
    expect(passwordResetTokens).toHaveProperty('createdAt');
  });

  it('should have token column as unique and not null', async () => {
    const { passwordResetTokens } = await import('@/db/schema/users');
    expect(passwordResetTokens.token.isUnique).toBe(true);
    expect(passwordResetTokens.token.notNull).toBe(true);
  });

  it('should have used column with default false', async () => {
    const { passwordResetTokens } = await import('@/db/schema/users');
    expect(passwordResetTokens.used.default).toBe(false);
  });
});
