import { describe, it, expect } from 'vitest';

describe('Admin Settings Route', () => {
  it('should export route from admin settings module', async () => {
    const mod = await import('@/routes/_authenticated/admin/settings');
    expect(mod).toHaveProperty('Route');
  });

  it('should have component defined for admin settings', async () => {
    const mod = await import('@/routes/_authenticated/admin/settings');
    expect(mod.Route.options?.component).toBeDefined();
  });
});
