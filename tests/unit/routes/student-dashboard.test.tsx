import { describe, it, expect } from 'vitest';

describe('Student Dashboard route', () => {
  it('should export route from student dashboard module', async () => {
    const mod = await import('@/routes/_authenticated/student/dashboard');
    expect(mod).toHaveProperty('Route');
  });
});
