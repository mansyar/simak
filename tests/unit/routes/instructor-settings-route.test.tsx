import { describe, it, expect } from 'vitest';

describe('Instructor Settings Route', () => {
  it('should export route from instructor settings module', async () => {
    const mod = await import('@/routes/_authenticated/instructor/settings');
    expect(mod).toHaveProperty('Route');
  });

  it('should have component defined for instructor settings', async () => {
    const mod = await import('@/routes/_authenticated/instructor/settings');
    expect(mod.Route.options?.component).toBeDefined();
  });
});
