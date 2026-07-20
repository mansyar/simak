/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @tanstack/react-start/server
vi.mock('@tanstack/react-start/server', () => ({
  getRequestHeaders: vi.fn().mockReturnValue(new Headers()),
}));

// Mock @tanstack/react-start
vi.mock('@tanstack/react-start', () => ({
  createServerFn: vi.fn().mockReturnValue({
    inputValidator: vi.fn().mockReturnThis(),
    handler: vi.fn().mockImplementation((fn) => fn),
  }),
}));

// Mock @tanstack/react-router
vi.mock('@tanstack/react-router', () => ({
  redirect: vi.fn().mockImplementation((opts) => {
    throw new Error(`REDIRECT: ${opts.to}`);
  }),
  createFileRoute: vi.fn().mockReturnValue((config: any) => ({
    ...config,
    useLoaderData: vi.fn().mockReturnValue({}),
  })),
}));

// Mock server dashboard
vi.mock('@/server/dashboard', () => ({
  getAdminDashboardData: vi.fn(),
  getInstructorDashboardData: vi.fn(),
  getStudentDashboardData: vi.fn(),
}));

// Mock __root
vi.mock('@/routes/__root', () => ({
  useI18n: vi.fn().mockReturnValue({
    t: vi.fn().mockImplementation((key: string) => key),
    locale: 'en',
    setLocale: vi.fn(),
  }),
}));

// Mock dashboard components
vi.mock('@/components/dashboard/AdminDashboard', () => ({
  AdminDashboard: vi.fn().mockReturnValue(null),
}));

vi.mock('@/components/dashboard/InstructorDashboard', () => ({
  InstructorDashboard: vi.fn().mockReturnValue(null),
}));

vi.mock('@/components/dashboard/StudentDashboard', () => ({
  StudentDashboard: vi.fn().mockReturnValue(null),
}));

describe('Dashboard Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Admin Dashboard', () => {
    it('should export Route', async () => {
      const { Route } = await import('@/routes/_authenticated/admin/dashboard');
      expect(Route).toBeDefined();
    });

    it('should have loader in route config', async () => {
      const { Route } = await import('@/routes/_authenticated/admin/dashboard');
      expect(Route).toHaveProperty('loader');
    });

    it('should have component in route config', async () => {
      const { Route } = await import('@/routes/_authenticated/admin/dashboard');
      expect(Route).toHaveProperty('component');
    });

    it('should have pendingComponent in route config', async () => {
      const { Route } = await import('@/routes/_authenticated/admin/dashboard');
      expect(Route).toHaveProperty('pendingComponent');
    });
  });

  describe('Instructor Dashboard', () => {
    it('should export Route', async () => {
      const { Route } = await import('@/routes/_authenticated/instructor/dashboard');
      expect(Route).toBeDefined();
    });

    it('should have loader in route config', async () => {
      const { Route } = await import('@/routes/_authenticated/instructor/dashboard');
      expect(Route).toHaveProperty('loader');
    });

    it('should have component in route config', async () => {
      const { Route } = await import('@/routes/_authenticated/instructor/dashboard');
      expect(Route).toHaveProperty('component');
    });

    it('should have pendingComponent in route config', async () => {
      const { Route } = await import('@/routes/_authenticated/instructor/dashboard');
      expect(Route).toHaveProperty('pendingComponent');
    });
  });

  describe('Student Dashboard', () => {
    it('should export Route', async () => {
      const { Route } = await import('@/routes/_authenticated/student/dashboard');
      expect(Route).toBeDefined();
    });

    it('should have loader in route config', async () => {
      const { Route } = await import('@/routes/_authenticated/student/dashboard');
      expect(Route).toHaveProperty('loader');
    });

    it('should have component in route config', async () => {
      const { Route } = await import('@/routes/_authenticated/student/dashboard');
      expect(Route).toHaveProperty('component');
    });

    it('should have pendingComponent in route config', async () => {
      const { Route } = await import('@/routes/_authenticated/student/dashboard');
      expect(Route).toHaveProperty('pendingComponent');
    });
  });
});
