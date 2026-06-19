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
describe('Student layout route (student)', () => {
  it('should export a Route from the student layout module', async () => {
    const mod = await import('@/routes/_authenticated/student');
    expect(mod).toHaveProperty('Route');
  });
  it('should have beforeLoad defined in route options', async () => {
    const { Route } = await import('@/routes/_authenticated/student');
    expect(Route.options).toBeDefined();
    expect(Route.options.beforeLoad).toBeDefined();
  });
  it('should export a component function from the student layout', async () => {
    const { Route } = await import('@/routes/_authenticated/student');
    expect(typeof Route.options.component).toBe('function');
  });
});
