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
    preload,
    ...props
  }: {
    to: string;
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
    preload?: string;
  }) => (
    <a
      href={to}
      className={className}
      data-testid={`sidebar-link-${to}`}
      data-preload={preload}
      onClick={onClick}
      {...props}
    >
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
    mockUseSession.mockReturnValue({
      data: {
        user: { name: 'Test Student', email: 'student@test.com' },
      },
    });
  });

  it('should render dashboard link', () => {
    mockLocation.mockReturnValue({ pathname: '/student/dashboard' });
    render(<StudentSidebar isOpen={true} onClose={vi.fn()} />);

    const dashboardLink = screen.getByTestId('sidebar-link-/student/dashboard');
    expect(dashboardLink).toBeDefined();
    expect(dashboardLink.textContent).toContain('studentSidebar.dashboard');
  });

  it('should render assignments link', () => {
    mockLocation.mockReturnValue({ pathname: '/student/dashboard' });
    render(<StudentSidebar isOpen={true} onClose={vi.fn()} />);

    const assignmentsLink = screen.getByTestId('sidebar-link-/student/assignments');
    expect(assignmentsLink).toBeDefined();
    expect(assignmentsLink.textContent).toContain('studentSidebar.assignments');
  });

  it('should render the academic records link', () => {
    mockLocation.mockReturnValue({ pathname: '/student/dashboard' });
    render(<StudentSidebar isOpen={true} onClose={vi.fn()} />);

    const academicRecordsLink = screen.getByTestId('sidebar-link-/student/academic-records');
    expect(academicRecordsLink.textContent).toContain('studentSidebar.academicRecords');
  });

  it('should highlight the currently active route with background accent', () => {
    mockLocation.mockReturnValue({ pathname: '/student/dashboard' });
    render(<StudentSidebar isOpen={true} onClose={vi.fn()} />);

    const dashboardLink = screen.getByTestId('sidebar-link-/student/dashboard');
    expect(dashboardLink.className).toContain('bg-sidebar-accent');
    expect(dashboardLink.className).toContain('text-sidebar-primary-foreground');
    expect(dashboardLink.className).not.toContain('border-l-[3px]');
  });

  it('should expose mobile drawer semantics, focus management, and active route state', () => {
    const mockOnClose = vi.fn();
    const trigger = document.createElement('button');
    trigger.id = 'mobile-menu-trigger';
    document.body.appendChild(trigger);
    const content = document.createElement('div');
    content.dataset.appContent = 'true';
    document.body.appendChild(content);
    mockLocation.mockReturnValue({ pathname: '/student/dashboard' });

    const { rerender } = render(<StudentSidebar isOpen onClose={mockOnClose} />);
    const drawer = document.getElementById('mobile-navigation-drawer');
    const dashboardLink = screen.getByTestId('sidebar-link-/student/dashboard');

    expect(drawer?.getAttribute('aria-label')).toBe('common.navigation');
    expect(drawer?.getAttribute('aria-hidden')).toBe('false');
    expect(document.activeElement).toBe(screen.getByLabelText('common.closeMenu'));
    expect(content.inert).toBe(true);
    expect(dashboardLink.getAttribute('aria-current')).toBe('page');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(mockOnClose).toHaveBeenCalled();

    rerender(<StudentSidebar isOpen={false} onClose={mockOnClose} />);
    expect(content.inert).toBe(false);
    expect(document.activeElement).toBe(trigger);

    trigger.remove();
    content.remove();
  });

  it('should highlight active route with sub-paths', () => {
    mockLocation.mockReturnValue({ pathname: '/student/assignments/1' });
    render(<StudentSidebar isOpen={true} onClose={vi.fn()} />);

    const assignmentsLink = screen.getByTestId('sidebar-link-/student/assignments');
    expect(assignmentsLink.className).toContain('bg-sidebar-accent');
    expect(assignmentsLink.className).toContain('text-sidebar-primary-foreground');
  });

  it('should not apply the active class to inactive routes', () => {
    mockLocation.mockReturnValue({ pathname: '/student/dashboard' });
    render(<StudentSidebar isOpen={true} onClose={vi.fn()} />);

    const assignmentsLink = screen.getByTestId('sidebar-link-/student/assignments');
    expect(assignmentsLink.className).not.toMatch(/(?<!:)bg-sidebar-accent(?= |$)/);
    expect(assignmentsLink.className).toContain('text-sidebar-foreground');
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

  it('should set preload="intent" on all sidebar links', () => {
    mockLocation.mockReturnValue({ pathname: '/student/dashboard' });
    render(<StudentSidebar isOpen={true} onClose={vi.fn()} />);

    const links = document.querySelectorAll('[data-testid^="sidebar-link-"]');
    expect(links.length).toBeGreaterThan(0);
    links.forEach((link) => {
      expect(link.getAttribute('data-preload')).toBe('intent');
    });
  });
});
