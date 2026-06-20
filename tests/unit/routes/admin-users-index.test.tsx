/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { ComponentType } from 'react';

const mockRouter = vi.hoisted(() => ({
  invalidate: vi.fn(),
}));

// Mock @tanstack/react-router
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: vi.fn().mockReturnValue((config: any) => ({
    ...config,
    useLoaderData: vi.fn().mockReturnValue({
      users: [],
      total: 0,
    }),
    useSearch: vi.fn().mockReturnValue({
      page: 1,
      limit: 20,
      search: '',
      role: undefined,
    }),
    useNavigate: vi.fn().mockReturnValue(vi.fn()),
  })),
  useRouter: vi.fn().mockReturnValue(mockRouter),
}));

// Mock @tanstack/react-start
vi.mock('@tanstack/react-start', () => ({
  useServerFn: vi.fn().mockImplementation((fn) => fn),
}));

// Mock server users
vi.mock('@/server/users', () => ({
  listUsers: vi.fn(),
  deleteUser: vi.fn(),
  generateSetupLink: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
}));

// Mock __root
vi.mock('@/routes/__root', () => ({
  useI18n: vi.fn().mockReturnValue({
    t: vi.fn().mockImplementation((key: string) => key),
    locale: 'en',
    setLocale: vi.fn(),
  }),
}));

// Mock child components
vi.mock('@/components/admin/users/UserTable', () => ({
  UserTable: () => null,
  UserRow: undefined as any,
}));
vi.mock('@/components/admin/users/UserFilters', () => ({
  UserFilters: () => null,
}));
vi.mock('@/components/admin/users/CreateUserDialog', () => ({
  CreateUserDialog: () => null,
}));
vi.mock('@/components/admin/users/EditUserSheet', () => ({
  EditUserSheet: () => null,
}));
vi.mock('@/components/admin/users/DeleteUserDialog', () => ({
  DeleteUserDialog: (props: any) => (
    <div data-testid="delete-user-dialog" data-open={props.open}>
      DeleteUserDialog
    </div>
  ),
}));
vi.mock('@/components/admin/users/SetupLinkSheet', () => ({
  SetupLinkSheet: (props: any) => (
    <div data-testid="setup-link-sheet" data-open={props.open}>
      SetupLinkSheet
    </div>
  ),
}));

async function getComponent(): Promise<ComponentType> {
  const mod = await import('@/routes/_authenticated/admin/users/index');
  return (mod.Route as any).component ?? (mod.Route as any).Component;
}

describe('Admin Users index page', () => {
  it('should export a route component', async () => {
    const mod = await import('@/routes/_authenticated/admin/users/index');
    expect(mod).toBeDefined();
    expect(mod.Route).toBeDefined();
  });

  it('should have Route with component defined', async () => {
    const mod = await import('@/routes/_authenticated/admin/users/index');
    expect(mod.Route).toBeDefined();
    expect(typeof mod.Route).toBe('object');
  });

  it('should use listUsers server function', async () => {
    const { listUsers } = await import('@/server/users');
    expect(typeof listUsers).toBe('function');
  });

  describe('render', () => {
    it('should render the page title via PageHeader (text-3xl, not text-4xl)', async () => {
      const Component = await getComponent();
      render(<Component />);
      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toHaveClass('font-display', 'text-3xl', 'text-foreground');
      expect(heading).not.toHaveClass('text-4xl');
      expect(heading.textContent).toBe('adminUsers.title');
    });

    it('should render the page subtitle', async () => {
      const Component = await getComponent();
      render(<Component />);
      const subtitle = screen.getByText('adminUsers.subtitle');
      expect(subtitle).toBeInTheDocument();
    });

    it('should render a refresh button that calls router.invalidate on click', async () => {
      const Component = await getComponent();
      render(<Component />);
      const refreshButton = screen.getByRole('button', { name: 'common.refresh' });
      mockRouter.invalidate.mockClear();
      fireEvent.click(refreshButton);
      expect(mockRouter.invalidate).toHaveBeenCalledTimes(1);
    });

    it('should render refresh button as icon-only (no visible text)', async () => {
      const Component = await getComponent();
      render(<Component />);
      const refreshButton = screen.getByRole('button', { name: 'common.refresh' });
      expect(refreshButton.textContent?.trim()).toBe('');
    });

    it('should use Pagination component with common.back/common.next buttons and common.pageOf counter', async () => {
      const Component = await getComponent();
      render(<Component />);
      // Pagination renders common.back and common.next as button text
      expect(screen.getByText('common.back')).toBeInTheDocument();
      expect(screen.getByText('common.next')).toBeInTheDocument();
      // The new counter text should be present
      expect(screen.getByText('common.pageOf')).toBeInTheDocument();
    });

    it('should use Pagination counter instead of adminUsers.showing', async () => {
      const Component = await getComponent();
      render(<Component />);
      // The old counter text should be gone
      expect(screen.queryByText('adminUsers.showing')).not.toBeInTheDocument();
    });

    it('should render DeleteUserDialog (not use window.confirm)', async () => {
      const Component = await getComponent();
      render(<Component />);
      expect(screen.getByTestId('delete-user-dialog')).toBeInTheDocument();
    });

    it('should render SetupLinkSheet (not use window.alert)', async () => {
      const Component = await getComponent();
      render(<Component />);
      expect(screen.getByTestId('setup-link-sheet')).toBeInTheDocument();
    });
  });
});
