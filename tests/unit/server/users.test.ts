import { describe, it, expect } from 'vitest';
import { z } from 'zod';

describe('User server functions module', () => {
  it('should export listUsers as a function', async () => {
    const mod = await import('@/server/users');
    expect(mod).toHaveProperty('listUsers');
    expect(typeof mod.listUsers).toBe('function');
  });

  it('should export getUser as a function', async () => {
    const mod = await import('@/server/users');
    expect(mod).toHaveProperty('getUser');
    expect(typeof mod.getUser).toBe('function');
  });

  it('should export createUser as a function', async () => {
    const mod = await import('@/server/users');
    expect(mod).toHaveProperty('createUser');
    expect(typeof mod.createUser).toBe('function');
  });

  it('should export updateUser as a function', async () => {
    const mod = await import('@/server/users');
    expect(mod).toHaveProperty('updateUser');
    expect(typeof mod.updateUser).toBe('function');
  });

  it('should export deleteUser as a function', async () => {
    const mod = await import('@/server/users');
    expect(mod).toHaveProperty('deleteUser');
    expect(typeof mod.deleteUser).toBe('function');
  });

  it('should export generateSetupLink as a function', async () => {
    const mod = await import('@/server/users');
    expect(mod).toHaveProperty('generateSetupLink');
    expect(typeof mod.generateSetupLink).toBe('function');
  });
});

describe('User Zod schemas', () => {
  it('should export CreateUserSchema that validates name, email, role', async () => {
    const mod = await import('@/server/users');
    expect(mod).toHaveProperty('CreateUserSchema');
    expect(mod.CreateUserSchema).toBeInstanceOf(z.ZodObject);
  });

  it('should accept valid user creation input', async () => {
    const mod = await import('@/server/users');
    const result = mod.CreateUserSchema.safeParse({
      name: 'John Doe',
      email: 'john@example.com',
      role: 'instructor',
    });
    expect(result.success).toBe(true);
  });

  it('should reject empty name', async () => {
    const mod = await import('@/server/users');
    const result = mod.CreateUserSchema.safeParse({
      name: '',
      email: 'john@example.com',
      role: 'student',
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid email', async () => {
    const mod = await import('@/server/users');
    const result = mod.CreateUserSchema.safeParse({
      name: 'John',
      email: 'not-an-email',
      role: 'student',
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid role', async () => {
    const mod = await import('@/server/users');
    const result = mod.CreateUserSchema.safeParse({
      name: 'John',
      email: 'john@example.com',
      role: 'superadmin',
    });
    expect(result.success).toBe(false);
  });

  it('should export UpdateUserSchema', async () => {
    const mod = await import('@/server/users');
    expect(mod).toHaveProperty('UpdateUserSchema');
    expect(mod.UpdateUserSchema).toBeInstanceOf(z.ZodObject);
  });

  it('should accept valid update input without role', async () => {
    const mod = await import('@/server/users');
    const result = mod.UpdateUserSchema.safeParse({
      name: 'John Updated',
      email: 'john.updated@example.com',
    });
    expect(result.success).toBe(true);
  });

  it('should export ListUsersSchema', async () => {
    const mod = await import('@/server/users');
    expect(mod).toHaveProperty('ListUsersSchema');
    expect(mod.ListUsersSchema).toBeInstanceOf(z.ZodObject);
  });
});

describe('Invitation email module', () => {
  it('should export sendInvitationEmail as a function', async () => {
    const mod = await import('@/lib/email');
    expect(mod).toHaveProperty('sendInvitationEmail');
    expect(typeof mod.sendInvitationEmail).toBe('function');
  });
});
