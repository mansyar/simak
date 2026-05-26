import { describe, it, expect } from 'vitest';
import { getRoleDashboard } from '@/lib/route-utils';

describe('getRoleDashboard', () => {
  it('should return /student/dashboard for student role', () => {
    expect(getRoleDashboard('student')).toBe('/student/dashboard');
  });

  it('should return /instructor/dashboard for instructor role', () => {
    expect(getRoleDashboard('instructor')).toBe('/instructor/dashboard');
  });

  it('should return /admin/dashboard for admin role', () => {
    expect(getRoleDashboard('admin')).toBe('/admin/dashboard');
  });

  it('should return /admin/dashboard for superadmin role', () => {
    expect(getRoleDashboard('superadmin')).toBe('/admin/dashboard');
  });

  it('should default to /student/dashboard for unknown role', () => {
    expect(getRoleDashboard('unknown' as any)).toBe('/student/dashboard');
  });
});
