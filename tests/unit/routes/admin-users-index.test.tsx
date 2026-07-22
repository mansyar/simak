/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom/vitest';
import type { ComponentType, ReactElement } from 'react';
import { userKeys } from '@/lib/query-keys';
import { listUsers, deleteUser } from '@/server/users';
import { toast } from 'sonner';

const mockRouter = vi.hoisted(() => ({
  invalidate: vi.fn(),
}));

const mockLoaderData = vi.hoisted(() => ({
  users: [] as Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    createdAt: string;
    emailVerified: boolean;
  }>,
  total: 0,
}));

// Mock @tanstack/react-router
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: vi.fn().mockReturnValue((config: any) => ({
    ...config,
    useLoaderData: vi.fn().mockReturnValue(mockLoaderData),
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
  listInstructorActiveAssignments: vi.fn(),
}));

// Mock server assignments
vi.mock('@/server/assignments', () => ({
  reassignAssignment: vi.fn(),
}));

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
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
  UserTable: (props: any) => (
    <div data-testid="user-table">
      <button
        data-testid="delete-user-btn"
        onClick={() =>
          props.onDelete({
            id: '1',
            name: 'Test User',
            email: 'test@test.com',
            role: 'student',
            createdAt: new Date().toISOString(),
            emailVerified: false,
          })
        }
      >
        Delete
      </button>
    </div>
  ),
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
      <button data-testid="delete-confirm" onClick={() => props.onConfirm().catch(() => {})}>
        Confirm
      </button>
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
vi.mock('@/components/admin/users/ReassignmentDialog', () => ({
  ReassignmentDialog: () => null,
}));

async function getComponent(): Promise<ComponentType> {
  const mod = await import('@/routes/_authenticated/admin/users/index');
  return (mod.Route as any).component ?? (mod.Route as any).Component;
}

let queryClient: QueryClient;

function renderWithQuery(ui: ReactElement) {
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('Admin Users index page', () => {
  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    mockLoaderData.users = [];
    mockLoaderData.total = 0;
    vi.mocked(listUsers).mockResolvedValue({ users: [], total: 0 } as any);
    vi.mocked(deleteUser).mockResolvedValue({ success: true } as any);
    mockRouter.invalidate.mockClear();
  });

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
      renderWithQuery(<Component />);
      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toHaveClass('font-display', 'text-3xl', 'text-foreground');
      expect(heading).not.toHaveClass('text-4xl');
      expect(heading.textContent).toBe('adminUsers.title');
    });

    it('should render the page subtitle', async () => {
      const Component = await getComponent();
      renderWithQuery(<Component />);
      const subtitle = screen.getByText('adminUsers.subtitle');
      expect(subtitle).toBeInTheDocument();
    });

    it('should render a refresh button that invalidates user query on click', async () => {
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
      const Component = await getComponent();
      renderWithQuery(<Component />);
      const refreshButton = screen.getByRole('button', { name: 'common.refresh' });
      fireEvent.click(refreshButton);
      await waitFor(() => {
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: userKeys.all() });
      });
    });

    it('should render refresh button as icon-only (no visible text)', async () => {
      const Component = await getComponent();
      renderWithQuery(<Component />);
      const refreshButton = screen.getByRole('button', { name: 'common.refresh' });
      expect(refreshButton.textContent?.trim()).toBe('');
    });

    it('should use Pagination component with common.back/common.next buttons and common.pageOf counter', async () => {
      mockLoaderData.users = [
        {
          id: '1',
          name: 'Test User',
          email: 'test@test.com',
          role: 'student',
          createdAt: new Date().toISOString(),
          emailVerified: false,
        },
      ];
      mockLoaderData.total = 1;
      const Component = await getComponent();
      renderWithQuery(<Component />);
      // Pagination renders common.back and common.next as button text
      expect(screen.getByText('common.back')).toBeInTheDocument();
      expect(screen.getByText('common.next')).toBeInTheDocument();
      // The new counter text should be present
      expect(screen.getByText('common.pageOf')).toBeInTheDocument();
    });

    it('should use Pagination counter instead of adminUsers.showing', async () => {
      mockLoaderData.users = [
        {
          id: '1',
          name: 'Test User',
          email: 'test@test.com',
          role: 'student',
          createdAt: new Date().toISOString(),
          emailVerified: false,
        },
      ];
      mockLoaderData.total = 1;
      const Component = await getComponent();
      renderWithQuery(<Component />);
      // The old counter text should be gone
      expect(screen.queryByText('adminUsers.showing')).not.toBeInTheDocument();
    });

    it('should NOT render Pagination when users list is empty', async () => {
      mockLoaderData.users = [];
      mockLoaderData.total = 0;
      const Component = await getComponent();
      renderWithQuery(<Component />);
      expect(screen.queryByText('common.back')).not.toBeInTheDocument();
      expect(screen.queryByText('common.next')).not.toBeInTheDocument();
    });

    it('should render DeleteUserDialog (not use window.confirm)', async () => {
      const Component = await getComponent();
      renderWithQuery(<Component />);
      expect(screen.getByTestId('delete-user-dialog')).toBeInTheDocument();
    });

    it('should render SetupLinkSheet (not use window.alert)', async () => {
      const Component = await getComponent();
      renderWithQuery(<Component />);
      expect(screen.getByTestId('setup-link-sheet')).toBeInTheDocument();
    });
  });

  describe('useQuery integration', () => {
    it('should register user list query with userKeys', async () => {
      const Component = await getComponent();
      renderWithQuery(<Component />);
      const query = queryClient.getQueryCache().find({
        queryKey: userKeys.list({
          page: 1,
          limit: 20,
          search: '',
          role: undefined,
        }),
      });
      expect(query).toBeDefined();
    });

    it('should invalidate user query on successful delete', async () => {
      vi.mocked(deleteUser).mockResolvedValue({ success: true } as any);
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const Component = await getComponent();
      renderWithQuery(<Component />);

      // Click delete button in UserTable to set deletingUser
      fireEvent.click(screen.getByTestId('delete-user-btn'));

      // Click confirm in DeleteUserDialog to trigger handleDelete
      fireEvent.click(screen.getByTestId('delete-confirm'));

      await waitFor(() => {
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: userKeys.all() });
      });
    });
  });

  describe('optimistic updates', () => {
    it('should optimistically remove the user from the list cache', async () => {
      mockLoaderData.users = [
        {
          id: '1',
          name: 'User 1',
          email: 'u1@test.com',
          role: 'student',
          createdAt: '',
          emailVerified: false,
        },
        {
          id: '2',
          name: 'User 2',
          email: 'u2@test.com',
          role: 'student',
          createdAt: '',
          emailVerified: false,
        },
      ];
      mockLoaderData.total = 2;
      vi.mocked(deleteUser).mockReturnValue(new Promise(() => {}));

      const Component = await getComponent();
      renderWithQuery(<Component />);

      const key = userKeys.list({ page: 1, limit: 20, search: '', role: undefined });
      await waitFor(() => expect(queryClient.getQueryData(key)).toBeDefined());

      fireEvent.click(screen.getByTestId('delete-user-btn'));
      fireEvent.click(screen.getByTestId('delete-confirm'));

      await waitFor(() => {
        const data = queryClient.getQueryData<{ users: { id: string }[]; total: number }>(key);
        expect(data?.users.find((u) => u.id === '1')).toBeUndefined();
        expect(data?.total).toBe(1);
      });
    });

    it('should restore the user on error', async () => {
      const seedUsers = [
        {
          id: '1',
          name: 'User 1',
          email: 'u1@test.com',
          role: 'student',
          createdAt: '',
          emailVerified: false,
        },
      ];
      mockLoaderData.users = seedUsers;
      mockLoaderData.total = 1;
      vi.mocked(listUsers).mockResolvedValue({ users: seedUsers, total: 1 } as any);
      vi.mocked(deleteUser).mockResolvedValue({
        error: { code: 'INTERNAL', message: 'Server error' },
      } as any);

      const Component = await getComponent();
      renderWithQuery(<Component />);

      const key = userKeys.list({ page: 1, limit: 20, search: '', role: undefined });
      await waitFor(() => expect(queryClient.getQueryData(key)).toBeDefined());

      fireEvent.click(screen.getByTestId('delete-user-btn'));
      fireEvent.click(screen.getByTestId('delete-confirm'));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Server error');
      });
      const data = queryClient.getQueryData<{ users: { id: string }[]; total: number }>(key);
      expect(data?.users.find((u) => u.id === '1')).toBeDefined();
      expect(data?.total).toBe(1);
    });
  });

  describe('pendingComponent', () => {
    it('should have pendingComponent in route config', async () => {
      const mod = await import('@/routes/_authenticated/admin/users/index');
      expect(mod.Route).toHaveProperty('pendingComponent');
    });
  });
});
