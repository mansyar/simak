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
