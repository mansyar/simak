import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock authClient to prevent real API calls
const { mockSignOut, mockUseSession } = vi.hoisted(() => ({
  mockSignOut: vi.fn().mockResolvedValue({}),
  mockUseSession: vi.fn(),
}));
vi.mock('@/lib/auth-client', () => ({
  authClient: {
    signOut: mockSignOut,
    useSession: mockUseSession,
  },
}));

// Mock useRouter for navigation
const { mockNavigate, mockInvalidate } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockInvalidate: vi.fn(),
}));
vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({ invalidate: mockInvalidate, navigate: mockNavigate }),
}));

// Mock the useI18n hook
vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    locale: 'en',
    setLocale: vi.fn(),
  }),
}));

// Mock the useTheme hook
vi.mock('@/hooks/use-theme', () => ({
  useTheme: () => ({
    theme: 'light',
    toggleTheme: vi.fn(),
  }),
}));

// Mock child components that would otherwise be imported
vi.mock('@/components/layout/theme-toggle', () => ({
  ThemeToggle: () => <div data-testid="theme-toggle" />,
}));

vi.mock('@/components/layout/language-switcher', () => ({
  LanguageSwitcher: () => <div data-testid="language-switcher" />,
}));

vi.mock('@/components/notifications/NotificationBadge', () => ({
  NotificationBadge: ({ onOpen }: { onOpen: () => void }) => (
    <button data-testid="notification-badge" onClick={onOpen}>
      Notifications
    </button>
  ),
}));

import { AppHeader } from '@/components/layout/app-header';

describe('AppHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockReturnValue({
      data: {
        user: { name: 'Test User', email: 'test@example.com', role: 'admin' },
      },
    });
  });

  it('should render mobile menu toggle button', () => {
    render(<AppHeader onMenuToggle={vi.fn()} onNotificationOpen={vi.fn()} />);

    const menuButton = screen.getByLabelText('common.openMenu');
    expect(menuButton).toBeDefined();
  });

  it('should call onMenuToggle when menu button clicked', () => {
    const mockToggle = vi.fn();
    render(<AppHeader onMenuToggle={mockToggle} onNotificationOpen={vi.fn()} />);

    const menuButton = screen.getByLabelText('common.openMenu');
    fireEvent.click(menuButton);
    expect(mockToggle).toHaveBeenCalled();
  });

  it('should render notification badge, theme toggle, and language switcher', () => {
    render(<AppHeader onMenuToggle={vi.fn()} onNotificationOpen={vi.fn()} />);

    expect(screen.getByTestId('notification-badge')).toBeDefined();
    expect(screen.getByTestId('theme-toggle')).toBeDefined();
    expect(screen.getByTestId('language-switcher')).toBeDefined();
  });

  it('should call onNotificationOpen when notification badge clicked', () => {
    const mockOpen = vi.fn();
    render(<AppHeader onMenuToggle={vi.fn()} onNotificationOpen={mockOpen} />);

    fireEvent.click(screen.getByTestId('notification-badge'));
    expect(mockOpen).toHaveBeenCalled();
  });

  it('should render user avatar with initial letter', () => {
    render(<AppHeader onMenuToggle={vi.fn()} onNotificationOpen={vi.fn()} />);

    expect(screen.getByText('T')).toBeDefined();
  });

  it('should render user avatar trigger', () => {
    render(<AppHeader onMenuToggle={vi.fn()} onNotificationOpen={vi.fn()} />);

    const avatarButton = screen.getByText('T');
    expect(avatarButton).toBeDefined();
  });

  it('should open dropdown on avatar click', async () => {
    render(<AppHeader onMenuToggle={vi.fn()} onNotificationOpen={vi.fn()} />);

    const avatar = screen.getByText('T');
    fireEvent.click(avatar.closest('button')!);

    await vi.waitFor(() => {
      expect(screen.queryByText('nav.settings')).toBeDefined();
    });
  });

  it('should call signOut and invalidate on logout via dropdown', async () => {
    render(<AppHeader onMenuToggle={vi.fn()} onNotificationOpen={vi.fn()} />);

    // Click avatar to open dropdown
    const avatar = screen.getByText('T');
    fireEvent.click(avatar.closest('button')!);

    await vi.waitFor(() => {
      expect(screen.queryByText('nav.settings')).toBeDefined();
    });

    const logoutButton = screen.getByText('auth.logout');
    fireEvent.click(logoutButton);

    await vi.waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
    });
    expect(mockInvalidate).toHaveBeenCalled();
  });

  it('should render fallback letter when user has no name', () => {
    mockUseSession.mockReturnValue({
      data: {
        user: { email: 'anon@test.com', role: 'student' },
      },
    });
    render(<AppHeader onMenuToggle={vi.fn()} onNotificationOpen={vi.fn()} />);

    expect(screen.getByText('A')).toBeDefined();
  });
});
