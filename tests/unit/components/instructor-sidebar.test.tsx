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

import { InstructorSidebar } from '@/components/layout/instructor-sidebar';

describe('InstructorSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockReturnValue({
      data: {
        user: { name: 'Instructor User', email: 'instructor@example.com', role: 'instructor' },
        session: {},
      },
      isPending: false,
    });
  });

  it('should render dashboard link', () => {
    mockLocation.mockReturnValue({ pathname: '/instructor/dashboard' });
    render(<InstructorSidebar isOpen={true} onClose={vi.fn()} />);

    const dashboardLink = screen.getByTestId('sidebar-link-/instructor/dashboard');
    expect(dashboardLink).toBeDefined();
    expect(dashboardLink.textContent).toBe('instructorSidebar.dashboard');
  });

  it('should render assignments link', () => {
    mockLocation.mockReturnValue({ pathname: '/instructor/dashboard' });
    render(<InstructorSidebar isOpen={true} onClose={vi.fn()} />);

    const assignmentsLink = screen.getByTestId('sidebar-link-/instructor/assignments');
    expect(assignmentsLink).toBeDefined();
    expect(assignmentsLink.textContent).toBe('instructorSidebar.assignments');
  });

  it('should render the academic records link', () => {
    mockLocation.mockReturnValue({ pathname: '/instructor/dashboard' });
    render(<InstructorSidebar isOpen={true} onClose={vi.fn()} />);

    const academicRecordsLink = screen.getByTestId('sidebar-link-/instructor/academic-records');
    expect(academicRecordsLink.textContent).toBe('instructorSidebar.academicRecords');
  });

  it('should render reviews link', () => {
    mockLocation.mockReturnValue({ pathname: '/instructor/dashboard' });
    render(<InstructorSidebar isOpen={true} onClose={vi.fn()} />);

    const reviewsLink = screen.getByTestId('sidebar-link-/instructor/reviews');
    expect(reviewsLink).toBeDefined();
    expect(reviewsLink.textContent).toBe('instructorSidebar.reviews');
  });

  it('should render feedback snippets link', () => {
    mockLocation.mockReturnValue({ pathname: '/instructor/dashboard' });
    render(<InstructorSidebar isOpen={true} onClose={vi.fn()} />);

    const snippetsLink = screen.getByTestId('sidebar-link-/instructor/feedback-snippets');
    expect(snippetsLink).toBeDefined();
    expect(snippetsLink.textContent).toBe('instructorSidebar.feedbackSnippets');
  });

  it('should render the reports link', () => {
    mockLocation.mockReturnValue({ pathname: '/instructor/dashboard' });
    render(<InstructorSidebar isOpen={true} onClose={vi.fn()} />);

    const reportsLink = screen.getByTestId('sidebar-link-/instructor/reports');
    expect(reportsLink).toBeDefined();
    expect(reportsLink.textContent).toContain('instructorSidebar.reports');
  });

  it('should highlight the reports route', () => {
    mockLocation.mockReturnValue({ pathname: '/instructor/reports' });
    render(<InstructorSidebar isOpen={true} onClose={vi.fn()} />);

    const reportsLink = screen.getByTestId('sidebar-link-/instructor/reports');
    expect(reportsLink.className).toContain('bg-sidebar-accent');
    expect(reportsLink.className).toContain('text-sidebar-primary-foreground');
    expect(reportsLink.getAttribute('aria-current')).toBe('page');
  });

  it('should highlight the feedback snippets route', () => {
    mockLocation.mockReturnValue({ pathname: '/instructor/feedback-snippets' });
    render(<InstructorSidebar isOpen={true} onClose={vi.fn()} />);

    const snippetsLink = screen.getByTestId('sidebar-link-/instructor/feedback-snippets');
    expect(snippetsLink.className).toContain('bg-sidebar-accent');
  });

  it('should highlight the currently active route', () => {
    mockLocation.mockReturnValue({ pathname: '/instructor/dashboard' });
    render(<InstructorSidebar isOpen={true} onClose={vi.fn()} />);

    const dashboardLink = screen.getByTestId('sidebar-link-/instructor/dashboard');
    expect(dashboardLink.className).toContain('bg-sidebar-accent');
    expect(dashboardLink.className).toContain('text-sidebar-primary-foreground');
    expect(dashboardLink.className).not.toContain('border-l-[3px]');
    expect(dashboardLink.getAttribute('aria-current')).toBe('page');
  });

  it('should not apply the active class to inactive routes', () => {
    mockLocation.mockReturnValue({ pathname: '/instructor/reviews' });
    render(<InstructorSidebar isOpen={true} onClose={vi.fn()} />);

    const dashboardLink = screen.getByTestId('sidebar-link-/instructor/dashboard');
    expect(dashboardLink.className).not.toMatch(/(?<!:)bg-sidebar-accent(?= |$)/);
  });

  it('should render logout button', () => {
    mockLocation.mockReturnValue({ pathname: '/instructor/dashboard' });
    render(<InstructorSidebar isOpen={true} onClose={vi.fn()} />);

    const logoutButton = screen.getByText('auth.logout');
    expect(logoutButton).toBeDefined();
  });

  it('should call signOut and invalidate on logout', async () => {
    mockLocation.mockReturnValue({ pathname: '/instructor/dashboard' });
    render(<InstructorSidebar isOpen={true} onClose={vi.fn()} />);

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
    mockLocation.mockReturnValue({ pathname: '/instructor/dashboard' });
    render(<InstructorSidebar isOpen={true} onClose={mockOnClose} />);

    const dashboardLink = screen.getByTestId('sidebar-link-/instructor/dashboard');
    fireEvent.click(dashboardLink);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should call onClose when overlay is clicked', () => {
    const mockOnClose = vi.fn();
    mockLocation.mockReturnValue({ pathname: '/instructor/dashboard' });
    render(<InstructorSidebar isOpen={true} onClose={mockOnClose} />);

    const overlay = document.querySelector('.fixed.inset-0.z-40');
    if (overlay) {
      fireEvent.click(overlay);
      expect(mockOnClose).toHaveBeenCalled();
    }
  });

  it('should call onClose when close button is clicked', () => {
    const mockOnClose = vi.fn();
    mockLocation.mockReturnValue({ pathname: '/instructor/dashboard' });
    render(<InstructorSidebar isOpen={true} onClose={mockOnClose} />);

    const closeButton = screen.getByLabelText('common.closeMenu');
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should set preload="intent" on all sidebar links', () => {
    mockLocation.mockReturnValue({ pathname: '/instructor/dashboard' });
    render(<InstructorSidebar isOpen={true} onClose={vi.fn()} />);

    const links = document.querySelectorAll('[data-testid^="sidebar-link-"]');
    expect(links.length).toBeGreaterThan(0);
    links.forEach((link) => {
      expect(link.getAttribute('data-preload')).toBe('intent');
    });
  });
});
