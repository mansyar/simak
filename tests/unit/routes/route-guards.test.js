/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
// Mock @tanstack/react-start/server
vi.mock('@tanstack/react-start/server', () => ({
  getRequestHeaders: vi.fn().mockReturnValue(new Headers()),
}));
// Mock @tanstack/react-start
vi.mock('@tanstack/react-start', () => ({
  createServerFn: vi.fn().mockReturnValue({
    handler: vi.fn().mockImplementation((fn) => fn),
  }),
}));
// Mock @tanstack/react-router
vi.mock('@tanstack/react-router', () => ({
  redirect: vi.fn().mockImplementation((opts) => {
    throw new Error(`REDIRECT: ${opts.to}`);
  }),
  createFileRoute: vi.fn().mockReturnValue((config) => config),
  Outlet: vi.fn().mockReturnValue(null),
}));
// Mock database
vi.mock('@/db/index', () => ({
  getDb: vi.fn(),
}));
// Mock auth config
vi.mock('@/auth/config', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));
// Mock route-utils
vi.mock('@/lib/route-utils', () => ({
  getRoleDashboard: vi.fn().mockImplementation((role) => {
    const dashboards = {
      superadmin: '/admin/dashboard',
      admin: '/admin/dashboard',
      instructor: '/instructor/dashboard',
      student: '/student/dashboard',
    };
    return dashboards[role] || '/dashboard';
  }),
}));
// Mock users schema
vi.mock('@/db/schema/users', () => ({
  users: {
    id: 'id',
    role: 'role',
    locale: 'locale',
  },
}));
// Mock layout components
vi.mock('@/components/layout/admin-sidebar', () => ({
  AdminSidebar: vi.fn().mockReturnValue(null),
}));
vi.mock('@/components/layout/instructor-sidebar', () => ({
  InstructorSidebar: vi.fn().mockReturnValue(null),
}));
vi.mock('@/components/layout/student-sidebar', () => ({
  StudentSidebar: vi.fn().mockReturnValue(null),
}));
vi.mock('@/components/layout/language-switcher', () => ({
  LanguageSwitcher: vi.fn().mockReturnValue(null),
}));
vi.mock('@/components/notifications/NotificationBadge', () => ({
  NotificationBadge: vi.fn().mockReturnValue(null),
}));
vi.mock('@/components/notifications/NotificationCenter', () => ({
  NotificationCenter: vi.fn().mockReturnValue(null),
}));
// Mock __root
vi.mock('@/routes/__root', () => ({
  useI18n: vi.fn().mockReturnValue({
    locale: 'en',
    setLocale: vi.fn(),
  }),
}));
describe('Route Guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  describe('_authenticated.tsx', () => {
    it('should export Route', async () => {
      const { Route } = await import('@/routes/_authenticated');
      expect(Route).toBeDefined();
    });
    it('should have beforeLoad function in route config', async () => {
      const { Route } = await import('@/routes/_authenticated');
      // The Route object should have a beforeLoad property from createFileRoute
      expect(Route).toHaveProperty('beforeLoad');
    });
    it('should have component in route config', async () => {
      const { Route } = await import('@/routes/_authenticated');
      expect(Route).toHaveProperty('component');
    });
  });
  describe('_unauthenticated.tsx', () => {
    it('should export Route', async () => {
      const { Route } = await import('@/routes/_unauthenticated');
      expect(Route).toBeDefined();
    });
    it('should have beforeLoad function in route config', async () => {
      const { Route } = await import('@/routes/_unauthenticated');
      expect(Route).toHaveProperty('beforeLoad');
    });
    it('should have component in route config', async () => {
      const { Route } = await import('@/routes/_unauthenticated');
      expect(Route).toHaveProperty('component');
    });
  });
  describe('Role-based layouts', () => {
    describe('admin.tsx', () => {
      it('should export Route', async () => {
        const { Route } = await import('@/routes/_authenticated/admin');
        expect(Route).toBeDefined();
      });
      it('should have beforeLoad function in route config', async () => {
        const { Route } = await import('@/routes/_authenticated/admin');
        expect(Route).toHaveProperty('beforeLoad');
      });
      it('should have component in route config', async () => {
        const { Route } = await import('@/routes/_authenticated/admin');
        expect(Route).toHaveProperty('component');
      });
    });
    describe('instructor.tsx', () => {
      it('should export Route', async () => {
        const { Route } = await import('@/routes/_authenticated/instructor');
        expect(Route).toBeDefined();
      });
      it('should have beforeLoad function in route config', async () => {
        const { Route } = await import('@/routes/_authenticated/instructor');
        expect(Route).toHaveProperty('beforeLoad');
      });
      it('should have component in route config', async () => {
        const { Route } = await import('@/routes/_authenticated/instructor');
        expect(Route).toHaveProperty('component');
      });
    });
    describe('student.tsx', () => {
      it('should export Route', async () => {
        const { Route } = await import('@/routes/_authenticated/student');
        expect(Route).toBeDefined();
      });
      it('should have beforeLoad function in route config', async () => {
        const { Route } = await import('@/routes/_authenticated/student');
        expect(Route).toHaveProperty('beforeLoad');
      });
      it('should have component in route config', async () => {
        const { Route } = await import('@/routes/_authenticated/student');
        expect(Route).toHaveProperty('component');
      });
    });
  });
});
