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

// Mock auth config before importing server/auth
vi.mock('@/auth/config', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
    handler: vi.fn(),
    options: {
      emailAndPassword: { enabled: true, sendResetPassword: vi.fn() },
      additionalFields: { role: { type: 'string', required: true } },
      plugins: [{ id: 'tanstack-start-cookies' }],
    },
  },
}));

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
