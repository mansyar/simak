import { describe, it, expect } from 'vitest';

describe('Admin layout route (_admin)', () => {
  it('should export a Route from the admin layout module', async () => {
    const mod = await import('@/routes/_authenticated/_admin');
    expect(mod).toHaveProperty('Route');
  });

  it('should have beforeLoad defined in route options', async () => {
    const { Route } = await import('@/routes/_authenticated/_admin');
    expect(Route.options).toBeDefined();
    expect(Route.options.beforeLoad).toBeDefined();
  });

  it('should export a component function from the admin layout', async () => {
    const { Route } = await import('@/routes/_authenticated/_admin');
    expect(typeof Route.options.component).toBe('function');
  });
});

describe('Admin users route', () => {
  it('should export a Route from the users list module', async () => {
    const mod = await import('@/routes/_authenticated/_admin/users');
    expect(mod).toHaveProperty('Route');
  });
});
