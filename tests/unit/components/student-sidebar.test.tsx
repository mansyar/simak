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

import { StudentSidebar } from '@/components/layout/student-sidebar';

describe('StudentSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render SIMAK Student title', () => {
    mockLocation.mockReturnValue({ pathname: '/student/dashboard' });
    render(<StudentSidebar isOpen={true} onClose={vi.fn()} />);

    const dashboardLink = screen.getByTestId('sidebar-link-/student/dashboard');
    expect(dashboardLink).toBeDefined();
    expect(dashboardLink.textContent).toBe('nav.dashboard');
  });

  it('should render assignments link', () => {
    mockLocation.mockReturnValue({ pathname: '/student/dashboard' });
    render(<StudentSidebar isOpen={true} onClose={vi.fn()} />);

    const assignmentsLink = screen.getByTestId('sidebar-link-/student/assignments');
    expect(assignmentsLink).toBeDefined();
    expect(assignmentsLink.textContent).toBe('nav.assignments');
  });

  it('should highlight the currently active route', () => {
    mockLocation.mockReturnValue({ pathname: '/student/dashboard' });
    render(<StudentSidebar isOpen={true} onClose={vi.fn()} />);

    const dashboardLink = screen.getByTestId('sidebar-link-/student/dashboard');
    expect(dashboardLink.className).toContain('bg-primary');
    expect(dashboardLink.className).toContain('text-primary-foreground');
  });

  it('should highlight active route with sub-paths', () => {
    mockLocation.mockReturnValue({ pathname: '/student/assignments/1' });
    render(<StudentSidebar isOpen={true} onClose={vi.fn()} />);

    const assignmentsLink = screen.getByTestId('sidebar-link-/student/assignments');
    expect(assignmentsLink.className).toContain('bg-primary');
    expect(assignmentsLink.className).toContain('text-primary-foreground');
  });

  it('should not apply the active class to inactive routes', () => {
    mockLocation.mockReturnValue({ pathname: '/student/dashboard' });
    render(<StudentSidebar isOpen={true} onClose={vi.fn()} />);

    const assignmentsLink = screen.getByTestId('sidebar-link-/student/assignments');
    expect(assignmentsLink.className).not.toContain('bg-primary');
    expect(assignmentsLink.className).toContain('text-muted-foreground');
  });

  it('should render logout button', () => {
    mockLocation.mockReturnValue({ pathname: '/student/dashboard' });
    render(<StudentSidebar isOpen={true} onClose={vi.fn()} />);

    const logoutButton = screen.getByText('auth.logout');
    expect(logoutButton).toBeDefined();
  });
});
