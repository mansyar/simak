import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock the useLocation hook from TanStack Router
const mockLocation = vi.fn();
vi.mock('@tanstack/react-router', () => ({
  useLocation: () => mockLocation(),
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
    mockLocation.mockReturnValue({ pathname: '/admin/users' });
    render(<AdminSidebar />);

    const dashboardLink = screen.getByTestId('sidebar-link-/admin/dashboard');
    expect(dashboardLink).toBeDefined();
    expect(dashboardLink.textContent).toBe('adminSidebar.dashboard');
  });

  it('should render users link', () => {
    mockLocation.mockReturnValue({ pathname: '/admin/users' });
    render(<AdminSidebar />);

    const usersLink = screen.getByTestId('sidebar-link-/admin/users');
    expect(usersLink).toBeDefined();
    expect(usersLink.textContent).toBe('adminSidebar.users');
  });

  it('should render templates link', () => {
    mockLocation.mockReturnValue({ pathname: '/admin/users' });
    render(<AdminSidebar />);

    const templatesLink = screen.getByTestId('sidebar-link-/admin/templates');
    expect(templatesLink).toBeDefined();
    expect(templatesLink.textContent).toBe('adminSidebar.templates');
  });

  it('should highlight the currently active route', () => {
    mockLocation.mockReturnValue({ pathname: '/admin/users' });
    render(<AdminSidebar />);

    const usersLink = screen.getByTestId('sidebar-link-/admin/users');
    expect(usersLink.className).toContain('bg-accent');
    expect(usersLink.className).toContain('text-accent-foreground');
  });

  it('should not apply the active class to inactive routes', () => {
    mockLocation.mockReturnValue({ pathname: '/admin/users' });
    render(<AdminSidebar />);

    const dashboardLink = screen.getByTestId('sidebar-link-/admin/dashboard');
    // Inactive link should NOT have standalone bg-accent (only hover:bg-accent/50 for hover state)
    const classes = dashboardLink.className.split(' ');
    const activeClasses = classes.filter((c) => c === 'bg-accent');
    expect(activeClasses).toHaveLength(0);
  });
});
