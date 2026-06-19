import { describe, it, expect } from 'vitest';
describe('Instructor Dashboard route', () => {
  it('should export route from instructor dashboard module', async () => {
    const mod = await import('@/routes/_authenticated/instructor/dashboard');
    expect(mod).toHaveProperty('Route');
  });
});
