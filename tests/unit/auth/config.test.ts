import { describe, it, expect, vi } from 'vitest';

// Mock database before any imports
vi.mock('@/db/index', () => ({
  getDb: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  }),
  db: {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  },
}));

// Mock email module
vi.mock('@/lib/email', () => ({
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

describe('Auth server configuration', () => {
  it('should export auth instance from config module', async () => {
    const mod = await import('@/auth/config');
    expect(mod).toHaveProperty('auth');
  });

  it('should have auth.handler as a function', async () => {
    const { auth } = await import('@/auth/config');
    expect(typeof auth.handler).toBe('function');
  });

  it('should have auth.api with session methods', async () => {
    const { auth } = await import('@/auth/config');
    expect(auth.api).toHaveProperty('getSession');
    expect(typeof auth.api.getSession).toBe('function');
  });

  it('should have additionalFields configured', async () => {
    const mod = await import('@/auth/config');
    const opts = mod.auth.options as Record<string, unknown>;
    expect(opts.additionalFields).toBeDefined();
  });

  it('should have tanstackStartCookies plugin', async () => {
    const mod = await import('@/auth/config');
    const opts = mod.auth.options as Record<string, unknown>;
    const plugins = opts.plugins as Array<{ id: string }>;
    expect(plugins.some((p) => p.id === 'tanstack-start-cookies')).toBe(true);
  });

  it('should have twoFactor plugin', async () => {
    const mod = await import('@/auth/config');
    const opts = mod.auth.options as Record<string, unknown>;
    const plugins = opts.plugins as Array<{ id: string }>;
    expect(plugins.some((p) => p.id === 'two-factor')).toBe(true);
  });

  it('should have sendResetPassword callback', async () => {
    const { auth } = await import('@/auth/config');
    const emailPw = (auth.options as Record<string, unknown>).emailAndPassword as Record<
      string,
      unknown
    >;
    expect(emailPw.enabled).toBe(true);
    expect(typeof emailPw.sendResetPassword).toBe('function');
  });
});

describe('Auth client', () => {
  it('should export authClient as a function from lib module', async () => {
    const mod = await import('@/lib/auth-client');
    expect(mod).toHaveProperty('authClient');
    expect(typeof mod.authClient).toBe('function');
  });
});

describe('Email integration', () => {
  it('should export sendPasswordResetEmail from email module', async () => {
    const mod = await import('@/lib/email');
    expect(mod).toHaveProperty('sendPasswordResetEmail');
    expect(typeof mod.sendPasswordResetEmail).toBe('function');
  });

  it('should have Resend import available', async () => {
    const mod = await import('resend');
    expect(mod).toHaveProperty('Resend');
  });
});
