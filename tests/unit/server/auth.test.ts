import { describe, it, expect } from 'vitest';

describe('Server auth module', () => {
  it('should export getSessionFromHeaders as a function', async () => {
    const mod = await import('@/server/auth');
    expect(mod).toHaveProperty('getSessionFromHeaders');
    expect(typeof mod.getSessionFromHeaders).toBe('function');
  });

  it('should export requireRole as a function', async () => {
    const mod = await import('@/server/auth');
    expect(mod).toHaveProperty('requireRole');
    expect(typeof mod.requireRole).toBe('function');
  });
});

describe('DB index module', () => {
  it('should export db and getDb', async () => {
    const mod = await import('@/db/index');
    expect(mod.db).toBeDefined();
    expect(typeof mod.getDb).toBe('function');
  });
});
