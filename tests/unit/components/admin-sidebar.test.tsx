import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock authClient to prevent real API calls
vi.mock('@/lib/auth-client', () => ({
  authClient: {
    signOut: vi.fn().mockResolvedValue({}),
  },
}));

// Mock the useLocation and useRouter hooks from TanStack Router
const mockLocation = vi.fn();
vi.mock('@tanstack/react-router', () => ({
  useLocation: () => mockLocation(),
  useRouter: () => ({ invalidate: vi.fn() }),
  Link: ({
    to,
    children,
    className,
  }: {
    to: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={to} className={className} data-testid={`sidebar-link-${to}`}>
      {children}
    </a>
  ),
}));

// Mock the useI18n hook
vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

import { AdminSidebar } from '@/components/layout/admin-sidebar';

describe('AdminSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render dashboard link', () => {
    mockLocation.mockReturnValue({ pathname: '/admin/dashboard' });
    render(<AdminSidebar isOpen={true} onClose={vi.fn()} />);

    const dashboardLink = screen.getByTestId('sidebar-link-/admin/dashboard');
    expect(dashboardLink).toBeDefined();
    expect(dashboardLink.textContent).toBe('adminSidebar.dashboard');
  });

  it('should render users link', () => {
    mockLocation.mockReturnValue({ pathname: '/admin/dashboard' });
    render(<AdminSidebar isOpen={true} onClose={vi.fn()} />);

    const usersLink = screen.getByTestId('sidebar-link-/admin/users');
    expect(usersLink).toBeDefined();
    expect(usersLink.textContent).toBe('adminSidebar.users');
  });

  it('should render templates link', () => {
    mockLocation.mockReturnValue({ pathname: '/admin/dashboard' });
    render(<AdminSidebar isOpen={true} onClose={vi.fn()} />);

    const templatesLink = screen.getByTestId('sidebar-link-/admin/templates');
    expect(templatesLink).toBeDefined();
    expect(templatesLink.textContent).toBe('adminSidebar.templates');
  });

  it('should highlight the currently active route', () => {
    mockLocation.mockReturnValue({ pathname: '/admin/dashboard' });
    render(<AdminSidebar isOpen={true} onClose={vi.fn()} />);

    const dashboardLink = screen.getByTestId('sidebar-link-/admin/dashboard');
    expect(dashboardLink.className).toContain('bg-primary');
    expect(dashboardLink.className).toContain('text-primary-foreground');
  });

  it('should not apply the active class to inactive routes', () => {
    mockLocation.mockReturnValue({ pathname: '/admin/templates' });
    render(<AdminSidebar isOpen={true} onClose={vi.fn()} />);

    const dashboardLink = screen.getByTestId('sidebar-link-/admin/dashboard');
    expect(dashboardLink.className).not.toContain('bg-primary');
  });

  it('should render logout button', () => {
    mockLocation.mockReturnValue({ pathname: '/admin/dashboard' });
    render(<AdminSidebar isOpen={true} onClose={vi.fn()} />);

    const logoutButton = screen.getByText('auth.logout');
    expect(logoutButton).toBeDefined();
  });
});
