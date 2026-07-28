/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

// Mock @tanstack/react-router
vi.mock('@tanstack/react-router', () => ({
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

// Mock __root useI18n
vi.mock('@/routes/__root', () => ({
  useI18n: vi.fn().mockReturnValue({
    t: vi.fn().mockImplementation((key: string) => key),
    locale: 'en',
    setLocale: vi.fn(),
  }),
}));

// Mock auth-client
vi.mock('@/lib/auth-client', () => ({
  authClient: {
    useSession: vi.fn().mockReturnValue({
      data: { user: { name: 'Test', email: 'test@test.com', role: 'student' } },
    }),
    signOut: vi.fn(),
  },
}));

// Mock useTheme
vi.mock('@/hooks/use-theme', () => ({
  useTheme: vi.fn().mockReturnValue({
    theme: 'light',
    toggleTheme: vi.fn(),
  }),
}));

// Mock useKeyboardShortcuts
vi.mock('@/hooks/use-keyboard-shortcuts', () => ({
  useKeyboardShortcuts: vi.fn().mockReturnValue({
    cheatSheetOpen: false,
    setCheatSheetOpen: vi.fn(),
  }),
}));

// Mock child components
vi.mock('@/components/layout/theme-toggle', () => ({
  ThemeToggle: () => <div data-testid="theme-toggle" />,
}));
vi.mock('@/components/layout/language-switcher', () => ({
  LanguageSwitcher: () => <div data-testid="language-switcher" />,
}));
vi.mock('@/components/notifications/NotificationBadge', () => ({
  NotificationBadge: () => <div data-testid="notification-badge" />,
}));

// Mock KeyboardCheatSheet to render a marker element
vi.mock('@/components/keyboard-cheat-sheet', () => ({
  KeyboardCheatSheet: () => <div data-testid="cheat-sheet-trigger" />,
}));

describe('AppHeader — Region Containment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders KeyboardCheatSheet trigger inside <header> landmark', async () => {
    const { AppHeader } = await import('@/components/layout/app-header');
    const { container } = render(<AppHeader onMenuToggle={vi.fn()} onNotificationOpen={vi.fn()} />);
    const header = container.querySelector('header');
    expect(header).not.toBeNull();
    const cheatSheet = header?.querySelector('[data-testid="cheat-sheet-trigger"]');
    expect(cheatSheet).not.toBeNull();
  });
});
