import { jsx as _jsx } from 'react/jsx-runtime';
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
  Link: ({ to, children, className, onClick }) =>
    _jsx('a', {
      href: to,
      className: className,
      'data-testid': `sidebar-link-${to}`,
      onClick: onClick,
      children: children,
    }),
}));
// Mock the useI18n hook
vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key) => key,
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
    render(_jsx(AdminSidebar, { isOpen: true, onClose: vi.fn() }));
    const dashboardLink = screen.getByTestId('sidebar-link-/admin/dashboard');
    expect(dashboardLink).toBeDefined();
    expect(dashboardLink.textContent).toBe('adminSidebar.dashboard');
  });
  it('should render users link', () => {
    mockLocation.mockReturnValue({ pathname: '/admin/dashboard' });
    render(_jsx(AdminSidebar, { isOpen: true, onClose: vi.fn() }));
    const usersLink = screen.getByTestId('sidebar-link-/admin/users');
    expect(usersLink).toBeDefined();
    expect(usersLink.textContent).toBe('adminSidebar.users');
  });
  it('should render templates link', () => {
    mockLocation.mockReturnValue({ pathname: '/admin/dashboard' });
    render(_jsx(AdminSidebar, { isOpen: true, onClose: vi.fn() }));
    const templatesLink = screen.getByTestId('sidebar-link-/admin/templates');
    expect(templatesLink).toBeDefined();
    expect(templatesLink.textContent).toBe('adminSidebar.templates');
  });
  it('should highlight the currently active route', () => {
    mockLocation.mockReturnValue({ pathname: '/admin/dashboard' });
    render(_jsx(AdminSidebar, { isOpen: true, onClose: vi.fn() }));
    const dashboardLink = screen.getByTestId('sidebar-link-/admin/dashboard');
    expect(dashboardLink.className).toContain('bg-sidebar-accent');
    expect(dashboardLink.className).toContain('text-sidebar-primary-foreground');
    expect(dashboardLink.className).not.toContain('border-l-[3px]');
  });
  it('should not apply the active class to inactive routes', () => {
    mockLocation.mockReturnValue({ pathname: '/admin/templates' });
    render(_jsx(AdminSidebar, { isOpen: true, onClose: vi.fn() }));
    const dashboardLink = screen.getByTestId('sidebar-link-/admin/dashboard');
    expect(dashboardLink.className).not.toMatch(/(?<!:)bg-sidebar-accent(?= |$)/);
  });
  it('should render logout button', () => {
    mockLocation.mockReturnValue({ pathname: '/admin/dashboard' });
    render(_jsx(AdminSidebar, { isOpen: true, onClose: vi.fn() }));
    const logoutButton = screen.getByText('auth.logout');
    expect(logoutButton).toBeDefined();
  });
  it('should call signOut and invalidate on logout', async () => {
    mockLocation.mockReturnValue({ pathname: '/admin/dashboard' });
    render(_jsx(AdminSidebar, { isOpen: true, onClose: vi.fn() }));
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
    render(_jsx(AdminSidebar, { isOpen: true, onClose: mockOnClose }));
    const dashboardLink = screen.getByTestId('sidebar-link-/admin/dashboard');
    fireEvent.click(dashboardLink);
    expect(mockOnClose).toHaveBeenCalled();
  });
  it('should call onClose when overlay is clicked', () => {
    const mockOnClose = vi.fn();
    mockLocation.mockReturnValue({ pathname: '/admin/dashboard' });
    render(_jsx(AdminSidebar, { isOpen: true, onClose: mockOnClose }));
    const overlay = document.querySelector('.fixed.inset-0.z-40');
    if (overlay) {
      fireEvent.click(overlay);
      expect(mockOnClose).toHaveBeenCalled();
    }
  });
  it('should call onClose when close button is clicked', () => {
    const mockOnClose = vi.fn();
    mockLocation.mockReturnValue({ pathname: '/admin/dashboard' });
    render(_jsx(AdminSidebar, { isOpen: true, onClose: mockOnClose }));
    const closeButton = screen.getByLabelText('common.closeMenu');
    fireEvent.click(closeButton);
    expect(mockOnClose).toHaveBeenCalled();
  });
});
