import { describe, it, expect } from 'vitest';

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
