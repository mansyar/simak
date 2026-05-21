import { describe, it, expect } from 'vitest';

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
