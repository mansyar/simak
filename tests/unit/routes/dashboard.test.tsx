import { describe, it, expect } from 'vitest';

describe('Auth route guards', () => {
  it('should export unauthenticated route module', async () => {
    const mod = await import('@/routes/_unauthenticated');
    expect(mod).toHaveProperty('Route');
  });

  it('should export authenticated route module', async () => {
    const mod = await import('@/routes/_authenticated');
    expect(mod).toHaveProperty('Route');
  });

  it('should export login route module', async () => {
    const mod = await import('@/routes/_unauthenticated/auth/login');
    expect(mod).toHaveProperty('Route');
  });
});
