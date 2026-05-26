/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import {
  GetStudentDashboardDataSchema,
  GetInstructorDashboardDataSchema,
  GetAdminDashboardDataSchema,
  getStudentDashboardData,
  getInstructorDashboardData,
  getAdminDashboardData,
} from '@/server/dashboard';

vi.mock('@tanstack/react-start', () => ({
  createServerFn: vi.fn().mockReturnValue({
    handler: vi.fn().mockImplementation((fn) => fn),
  }),
}));

// Schema validation tests
describe('Dashboard schemas', () => {
  describe('GetStudentDashboardDataSchema', () => {
    it('should accept empty input', () => {
      const result = GetStudentDashboardDataSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  describe('GetInstructorDashboardDataSchema', () => {
    it('should accept empty input', () => {
      const result = GetInstructorDashboardDataSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  describe('GetAdminDashboardDataSchema', () => {
    it('should accept empty input', () => {
      const result = GetAdminDashboardDataSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });
});

// Server function stub tests
describe('Dashboard server function stubs', () => {
  it('should export getStudentDashboardData as a function', () => {
    expect(typeof getStudentDashboardData).toBe('function');
  });

  it('should export getInstructorDashboardData as a function', () => {
    expect(typeof getInstructorDashboardData).toBe('function');
  });

  it('should export getAdminDashboardData as a function', () => {
    expect(typeof getAdminDashboardData).toBe('function');
  });
});
