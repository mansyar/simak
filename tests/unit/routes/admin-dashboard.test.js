import { describe, it, expect } from 'vitest';
describe('Admin Dashboard route', () => {
  it('should export route from admin dashboard module', async () => {
    const mod = await import('@/routes/_authenticated/admin/dashboard');
    expect(mod).toHaveProperty('Route');
  });
});
