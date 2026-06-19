/** @vitest-environment node */
import { describe, it, expect, vi } from 'vitest';
// Mock createServerFn before importing
vi.mock('@tanstack/react-start', () => ({
  createServerFn: vi.fn().mockReturnValue({
    handler: vi.fn().mockImplementation((fn) => fn),
  }),
}));
import {
  GetStudentDashboardDataSchema,
  GetInstructorDashboardDataSchema,
  GetAdminDashboardDataSchema,
} from '@/server/dashboard';
describe('Dashboard Schemas', () => {
  describe('GetStudentDashboardDataSchema', () => {
    it('should accept empty object', () => {
      const result = GetStudentDashboardDataSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });
  describe('GetInstructorDashboardDataSchema', () => {
    it('should accept empty object', () => {
      const result = GetInstructorDashboardDataSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });
  describe('GetAdminDashboardDataSchema', () => {
    it('should accept empty object', () => {
      const result = GetAdminDashboardDataSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });
  describe('Server Function Stubs', () => {
    it('should export getStudentDashboardData function', async () => {
      const { getStudentDashboardData } = await import('@/server/dashboard');
      expect(getStudentDashboardData).toBeDefined();
      expect(typeof getStudentDashboardData).toBe('function');
    });
    it('should export getInstructorDashboardData function', async () => {
      const { getInstructorDashboardData } = await import('@/server/dashboard');
      expect(getInstructorDashboardData).toBeDefined();
      expect(typeof getInstructorDashboardData).toBe('function');
    });
    it('should export getAdminDashboardData function', async () => {
      const { getAdminDashboardData } = await import('@/server/dashboard');
      expect(getAdminDashboardData).toBeDefined();
      expect(typeof getAdminDashboardData).toBe('function');
    });
  });
});
