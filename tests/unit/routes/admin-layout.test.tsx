import { describe, it, expect, vi } from 'vitest';

// Mock auth module before importing routes
vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn().mockResolvedValue(null),
  requireRole: vi.fn().mockResolvedValue(undefined),
}));

// Mock database
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

describe('Admin layout route (admin)', () => {
  it('should export a Route from the admin layout module', async () => {
    const mod = await import('@/routes/_authenticated/admin');
    expect(mod).toHaveProperty('Route');
  });

  it('should have beforeLoad defined in route options', async () => {
    const { Route } = await import('@/routes/_authenticated/admin');
    expect(Route.options).toBeDefined();
    expect(Route.options.beforeLoad).toBeDefined();
  });

  it('should export a component function from the admin layout', async () => {
    const { Route } = await import('@/routes/_authenticated/admin');
    expect(typeof Route.options.component).toBe('function');
  });
});

describe('Admin users route', () => {
  it('should export a Route from the users list module', async () => {
    const mod = await import('@/routes/_authenticated/admin/users');
    expect(mod).toHaveProperty('Route');
  });
});
