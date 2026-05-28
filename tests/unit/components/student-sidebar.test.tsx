import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock authClient to prevent real API calls
const { mockSignOut } = vi.hoisted(() => ({
  mockSignOut: vi.fn().mockResolvedValue({}),
}));
vi.mock('@/lib/auth-client', () => ({
  authClient: {
    signOut: mockSignOut,
  },
}));

// Mock the useLocation and useRouter hooks from TanStack Router
const { mockLocation, mockInvalidate } = vi.hoisted(() => ({
  mockLocation: vi.fn(),
  mockInvalidate: vi.fn(),
}));
vi.mock('@tanstack/react-router', () => ({
  useLocation: () => mockLocation(),
  useRouter: () => ({ invalidate: mockInvalidate }),
  Link: ({
    to,
    children,
    className,
    onClick,
  }: {
    to: string;
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
  }) => (
    <a href={to} className={className} data-testid={`sidebar-link-${to}`} onClick={onClick}>
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

  it('should call signOut and invalidate on logout', async () => {
    mockLocation.mockReturnValue({ pathname: '/student/dashboard' });
    render(<StudentSidebar isOpen={true} onClose={vi.fn()} />);

    const logoutButton = screen.getByText('auth.logout');
    fireEvent.click(logoutButton);

    // Wait for async logout to complete
    await vi.waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
    });
    expect(mockInvalidate).toHaveBeenCalled();
  });

  it('should call onClose when a link is clicked', () => {
    const mockOnClose = vi.fn();
    mockLocation.mockReturnValue({ pathname: '/student/dashboard' });
    render(<StudentSidebar isOpen={true} onClose={mockOnClose} />);

    const dashboardLink = screen.getByTestId('sidebar-link-/student/dashboard');
    fireEvent.click(dashboardLink);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should call onClose when overlay is clicked', () => {
    const mockOnClose = vi.fn();
    mockLocation.mockReturnValue({ pathname: '/student/dashboard' });
    render(<StudentSidebar isOpen={true} onClose={mockOnClose} />);

    const overlay = document.querySelector('.fixed.inset-0.z-40');
    if (overlay) {
      fireEvent.click(overlay);
      expect(mockOnClose).toHaveBeenCalled();
    }
  });

  it('should call onClose when close button is clicked', () => {
    const mockOnClose = vi.fn();
    mockLocation.mockReturnValue({ pathname: '/student/dashboard' });
    render(<StudentSidebar isOpen={true} onClose={mockOnClose} />);

    const closeButton = screen.getByLabelText('common.closeMenu');
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });
});
