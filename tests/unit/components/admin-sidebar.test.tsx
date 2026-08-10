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

import { AdminSidebar } from '@/components/layout/admin-sidebar';

describe('AdminSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockReturnValue({
      data: {
        user: { name: 'Admin User', email: 'admin@example.com', role: 'superadmin' },
        session: {},
      },
      isPending: false,
    });
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

  it('should render the academic records link', () => {
    mockLocation.mockReturnValue({ pathname: '/admin/dashboard' });
    render(<AdminSidebar isOpen={true} onClose={vi.fn()} />);

    const academicRecordsLink = screen.getByTestId('sidebar-link-/admin/academic-records');
    expect(academicRecordsLink.textContent).toBe('adminSidebar.academicRecords');
  });

  it('should render the reports link', () => {
    mockLocation.mockReturnValue({ pathname: '/admin/dashboard' });
    render(<AdminSidebar isOpen={true} onClose={vi.fn()} />);

    const reportsLink = screen.getByTestId('sidebar-link-/admin/reports');
    expect(reportsLink).toBeDefined();
    expect(reportsLink.textContent).toBe('adminSidebar.reports');
  });

  it('should highlight the reports route', () => {
    mockLocation.mockReturnValue({ pathname: '/admin/reports' });
    render(<AdminSidebar isOpen={true} onClose={vi.fn()} />);

    const reportsLink = screen.getByTestId('sidebar-link-/admin/reports');
    expect(reportsLink.className).toContain('bg-sidebar-accent');
    expect(reportsLink.className).toContain('text-sidebar-primary-foreground');
    expect(reportsLink.getAttribute('aria-current')).toBe('page');
  });

  it('should highlight the currently active route', () => {
    mockLocation.mockReturnValue({ pathname: '/admin/dashboard' });
    render(<AdminSidebar isOpen={true} onClose={vi.fn()} />);

    const dashboardLink = screen.getByTestId('sidebar-link-/admin/dashboard');
    expect(dashboardLink.className).toContain('bg-sidebar-accent');
    expect(dashboardLink.className).toContain('text-sidebar-primary-foreground');
    expect(dashboardLink.className).not.toContain('border-l-[3px]');
    expect(dashboardLink.getAttribute('aria-current')).toBe('page');
  });

  it('should not apply the active class to inactive routes', () => {
    mockLocation.mockReturnValue({ pathname: '/admin/templates' });
    render(<AdminSidebar isOpen={true} onClose={vi.fn()} />);

    const dashboardLink = screen.getByTestId('sidebar-link-/admin/dashboard');
    expect(dashboardLink.className).not.toMatch(/(?<!:)bg-sidebar-accent(?= |$)/);
  });

  it('should render logout button', () => {
    mockLocation.mockReturnValue({ pathname: '/admin/dashboard' });
    render(<AdminSidebar isOpen={true} onClose={vi.fn()} />);

    const logoutButton = screen.getByText('auth.logout');
    expect(logoutButton).toBeDefined();
  });

  it('should call signOut and invalidate on logout', async () => {
    mockLocation.mockReturnValue({ pathname: '/admin/dashboard' });
    render(<AdminSidebar isOpen={true} onClose={vi.fn()} />);

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
    mockLocation.mockReturnValue({ pathname: '/admin/dashboard' });
    render(<AdminSidebar isOpen={true} onClose={mockOnClose} />);

    const dashboardLink = screen.getByTestId('sidebar-link-/admin/dashboard');
    fireEvent.click(dashboardLink);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should call onClose when overlay is clicked', () => {
    const mockOnClose = vi.fn();
    mockLocation.mockReturnValue({ pathname: '/admin/dashboard' });
    render(<AdminSidebar isOpen={true} onClose={mockOnClose} />);

    const overlay = document.querySelector('.fixed.inset-0.z-40');
    if (overlay) {
      fireEvent.click(overlay);
      expect(mockOnClose).toHaveBeenCalled();
    }
  });

  it('should call onClose when close button is clicked', () => {
    const mockOnClose = vi.fn();
    mockLocation.mockReturnValue({ pathname: '/admin/dashboard' });
    render(<AdminSidebar isOpen={true} onClose={mockOnClose} />);

    const closeButton = screen.getByLabelText('common.closeMenu');
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should set preload="intent" on all sidebar links', () => {
    mockLocation.mockReturnValue({ pathname: '/admin/dashboard' });
    render(<AdminSidebar isOpen={true} onClose={vi.fn()} />);

    const links = document.querySelectorAll('[data-testid^="sidebar-link-"]');
    expect(links.length).toBeGreaterThan(0);
    links.forEach((link) => {
      expect(link.getAttribute('data-preload')).toBe('intent');
    });
  });
});
