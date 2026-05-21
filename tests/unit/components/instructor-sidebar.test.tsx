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

import { InstructorSidebar } from '@/components/layout/instructor-sidebar';

describe('InstructorSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render SIMAK Instructor title', () => {
    mockLocation.mockReturnValue({ pathname: '/dashboard' });
    render(<InstructorSidebar />);
    expect(screen.getByText('SIMAK Instructor')).toBeDefined();
  });

  it('should render dashboard link', () => {
    mockLocation.mockReturnValue({ pathname: '/dashboard' });
    render(<InstructorSidebar />);

    const dashboardLink = screen.getByTestId('sidebar-link-/dashboard');
    expect(dashboardLink).toBeDefined();
    expect(dashboardLink.textContent).toBe('nav.dashboard');
  });

  it('should render assignments link', () => {
    mockLocation.mockReturnValue({ pathname: '/dashboard' });
    render(<InstructorSidebar />);

    const assignmentsLink = screen.getByTestId('sidebar-link-/instructor/assignments');
    expect(assignmentsLink).toBeDefined();
    expect(assignmentsLink.textContent).toBe('nav.assignments');
  });

  it('should highlight the currently active route', () => {
    mockLocation.mockReturnValue({ pathname: '/dashboard' });
    render(<InstructorSidebar />);

    const dashboardLink = screen.getByTestId('sidebar-link-/dashboard');
    expect(dashboardLink.className).toContain('bg-primary');
    expect(dashboardLink.className).toContain('text-primary-foreground');
  });

  it('should highlight active route with sub-paths', () => {
    mockLocation.mockReturnValue({ pathname: '/instructor/assignments/new' });
    render(<InstructorSidebar />);

    const assignmentsLink = screen.getByTestId('sidebar-link-/instructor/assignments');
    expect(assignmentsLink.className).toContain('bg-primary');
    expect(assignmentsLink.className).toContain('text-primary-foreground');
  });

  it('should not apply the active class to inactive routes', () => {
    mockLocation.mockReturnValue({ pathname: '/dashboard' });
    render(<InstructorSidebar />);

    const assignmentsLink = screen.getByTestId('sidebar-link-/instructor/assignments');
    expect(assignmentsLink.className).not.toContain('bg-primary');
    expect(assignmentsLink.className).toContain('text-muted-foreground');
  });
});
