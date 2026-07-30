/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

// Mock @tanstack/react-router
vi.mock('@tanstack/react-router', () => ({
  redirect: vi.fn(),
  createFileRoute: vi.fn().mockReturnValue((config: any) => config),
  Outlet: () => <div data-testid="outlet-content">Outlet Content</div>,
  Link: ({ children, to, className, ...props }: any) => (
    <a href={to} className={className} {...props}>
      {children}
    </a>
  ),
  useRouter: vi.fn().mockReturnValue({
    navigate: vi.fn(),
    invalidate: vi.fn(),
  }),
  useMatchRoute: vi.fn().mockReturnValue(() => false),
}));

// Mock @tanstack/react-query (needed by useKeyboardShortcuts)
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: vi.fn().mockReturnValue({
    invalidateQueries: vi.fn(),
  }),
}));

// Mock useKeyboardShortcuts
vi.mock('@/hooks/use-keyboard-shortcuts', () => ({
  useKeyboardShortcuts: vi.fn().mockReturnValue({
    cheatSheetOpen: false,
    setCheatSheetOpen: vi.fn(),
  }),
}));

// Mock KeyboardCheatSheet
vi.mock('@/components/keyboard-cheat-sheet', () => ({
  KeyboardCheatSheet: () => <div data-testid="cheat-sheet-trigger" />,
}));

// Mock @tanstack/react-start
vi.mock('@tanstack/react-start', () => ({
  createServerFn: vi.fn().mockReturnValue({
    middleware: vi.fn().mockReturnThis(),
    inputValidator: vi.fn().mockReturnThis(),
    handler: vi.fn().mockImplementation((fn) => fn),
  }),
  createMiddleware: vi.fn().mockReturnValue({
    server: vi.fn().mockImplementation((fn) => fn),
  }),
}));

// Mock @tanstack/react-start/server
vi.mock('@tanstack/react-start/server', () => ({
  getRequestHeaders: vi.fn().mockReturnValue(new Headers()),
}));

// Mock auth
vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn().mockResolvedValue(null),
  requireRole: vi.fn().mockResolvedValue(undefined),
}));

// Mock database
vi.mock('@/db/index', () => ({
  getDb: vi.fn(),
  db: {},
}));

// Mock route-utils
vi.mock('@/lib/route-utils', () => ({
  getRoleDashboard: vi.fn().mockReturnValue('/student/dashboard'),
}));

// Mock layout child components
vi.mock('@/components/layout/student-sidebar', () => ({
  StudentSidebar: () => <div data-testid="student-sidebar" />,
}));
vi.mock('@/components/layout/instructor-sidebar', () => ({
  InstructorSidebar: () => <div data-testid="instructor-sidebar" />,
}));
vi.mock('@/components/layout/admin-sidebar', () => ({
  AdminSidebar: () => <div data-testid="admin-sidebar" />,
}));
vi.mock('@/components/layout/app-header', () => ({
  AppHeader: () => <div data-testid="app-header" />,
}));
vi.mock('@/components/notifications/NotificationCenter', () => ({
  NotificationCenter: () => <div data-testid="notification-center" />,
}));

// Mock __root useI18n
vi.mock('@/routes/__root', () => ({
  useI18n: vi.fn().mockReturnValue({
    t: vi.fn().mockImplementation((key: string) => key),
    locale: 'en',
    setLocale: vi.fn(),
  }),
}));

// Mock useTheme
vi.mock('@/hooks/use-theme', () => ({
  useTheme: vi.fn().mockReturnValue({
    theme: 'light',
    toggleTheme: vi.fn(),
  }),
}));

// Mock auth-client
vi.mock('@/lib/auth-client', () => ({
  authClient: {
    signIn: { email: vi.fn() },
  },
}));

// Mock LanguageSwitcher and ThemeToggle
vi.mock('@/components/layout/language-switcher', () => ({
  LanguageSwitcher: () => <div data-testid="language-switcher" />,
}));
vi.mock('@/components/layout/theme-toggle', () => ({
  ThemeToggle: () => <div data-testid="theme-toggle" />,
}));

describe('Layout Accessibility — Landmark Structure & Skip Link', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('_authenticated layout', () => {
    it('does NOT render KeyboardCheatSheet (moved to AppHeader)', async () => {
      const mod = await import('@/routes/_authenticated');
      const Component = (mod.Route as any).component;
      const { container } = render(<Component />);
      const cheatSheet = container.querySelector('[data-testid="cheat-sheet-trigger"]');
      expect(cheatSheet).toBeNull();
    });
  });

  describe('_unauthenticated layout', () => {
    it('renders a <main> landmark with id="main-content" and tabindex="-1" wrapping the Outlet', async () => {
      const mod = await import('@/routes/_unauthenticated');
      const Component = (mod.Route as any).component;
      const { container } = render(<Component />);
      const main = container.querySelector('main');
      expect(main).not.toBeNull();
      expect(main?.getAttribute('id')).toBe('main-content');
      expect(main?.getAttribute('tabindex')).toBe('-1');
      expect(main?.querySelector('[data-testid="outlet-content"]')).not.toBeNull();
    });
  });

  describe('student layout', () => {
    it('renders <main> with id="main-content" and tabindex="-1"', async () => {
      const mod = await import('@/routes/_authenticated/student');
      const Component = (mod.Route as any).component;
      const { container } = render(<Component />);
      const main = container.querySelector('main');
      expect(main).not.toBeNull();
      expect(main?.getAttribute('id')).toBe('main-content');
      expect(main?.getAttribute('tabindex')).toBe('-1');
    });
  });

  describe('instructor layout', () => {
    it('renders <main> with id="main-content" and tabindex="-1"', async () => {
      const mod = await import('@/routes/_authenticated/instructor');
      const Component = (mod.Route as any).component;
      const { container } = render(<Component />);
      const main = container.querySelector('main');
      expect(main).not.toBeNull();
      expect(main?.getAttribute('id')).toBe('main-content');
      expect(main?.getAttribute('tabindex')).toBe('-1');
    });
  });

  describe('admin layout', () => {
    it('renders <main> with id="main-content" and tabindex="-1"', async () => {
      const mod = await import('@/routes/_authenticated/admin');
      const Component = (mod.Route as any).component;
      const { container } = render(<Component />);
      const main = container.querySelector('main');
      expect(main).not.toBeNull();
      expect(main?.getAttribute('id')).toBe('main-content');
      expect(main?.getAttribute('tabindex')).toBe('-1');
    });
  });

  describe('landing page', () => {
    it('renders a <main> landmark with id="main-content" and tabindex="-1"', async () => {
      const { HomePage } = await import('@/routes/index');
      const { container } = render(<HomePage />);
      const main = container.querySelector('main');
      expect(main).not.toBeNull();
      expect(main?.getAttribute('id')).toBe('main-content');
      expect(main?.getAttribute('tabindex')).toBe('-1');
    });
  });

  describe('login page', () => {
    it('does NOT have id="main-content" on any element (prevents duplicate ID)', async () => {
      const mod = await import('@/routes/_unauthenticated/auth/login');
      const Component = (mod.Route as any).component;
      const { container } = render(<Component />);
      const elementsWithId = container.querySelectorAll('#main-content');
      expect(elementsWithId.length).toBe(0);
    });
  });
});
