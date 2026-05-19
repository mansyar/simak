import { describe, it, expect } from 'vitest';

describe('Dashboard route', () => {
  it('should export route from dashboard module', async () => {
    const mod = await import('@/routes/_authenticated/dashboard');
    expect(mod).toHaveProperty('Route');
  });

  it('should have a Route with options defined', async () => {
    const { Route } = await import('@/routes/_authenticated/dashboard');
    expect(Route.options).toBeDefined();
  });
});

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

describe('Login page component', () => {
  it('should export route with component from login module', async () => {
    const mod = await import('@/routes/_unauthenticated/auth/login');
    expect(mod).toHaveProperty('Route');
  });
});
