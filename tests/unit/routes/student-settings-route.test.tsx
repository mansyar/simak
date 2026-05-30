import { describe, it, expect } from 'vitest';

describe('Student Settings Route', () => {
  it('should export route from student settings module', async () => {
    const mod = await import('@/routes/_authenticated/student/settings');
    expect(mod).toHaveProperty('Route');
  });

  it('should have component defined for student settings', async () => {
    const mod = await import('@/routes/_authenticated/student/settings');
    expect(mod.Route.options?.component).toBeDefined();
  });
});
