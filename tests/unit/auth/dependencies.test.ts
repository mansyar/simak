import { describe, it, expect } from 'vitest';

describe('Auth dependencies', () => {
  it('should import better-auth successfully', async () => {
    const mod = await import('better-auth');
    expect(mod).toHaveProperty('betterAuth');
  });

  it('should import @better-auth/drizzle-adapter successfully', async () => {
    const mod = await import('@better-auth/drizzle-adapter');
    expect(mod).toHaveProperty('drizzleAdapter');
  });

  it('should import resend successfully', async () => {
    const mod = await import('resend');
    expect(mod).toHaveProperty('Resend');
  });
});
