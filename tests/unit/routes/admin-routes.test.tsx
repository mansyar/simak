/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @tanstack/react-start/server
vi.mock('@tanstack/react-start/server', () => ({
  getRequestHeaders: vi.fn().mockReturnValue(new Headers()),
}));

// Mock @tanstack/react-start
vi.mock('@tanstack/react-start', () => ({
  createServerFn: vi.fn().mockReturnValue({
    middleware: vi.fn().mockReturnThis(),
    inputValidator: vi.fn().mockReturnThis(),
    handler: vi.fn().mockImplementation((fn) => fn),
  }),
  createMiddleware: vi.fn().mockReturnValue({
    server: vi.fn().mockImplementation((fn) => fn),
  }),
}));

// Mock @tanstack/react-router
vi.mock('@tanstack/react-router', () => ({
  redirect: vi.fn().mockImplementation((opts) => {
    throw new Error(`REDIRECT: ${opts.to}`);
  }),
  createFileRoute: vi.fn().mockReturnValue((config: any) => ({
    ...config,
    useLoaderData: vi.fn().mockReturnValue({ users: [], total: 0 }),
    useSearch: vi.fn().mockReturnValue({ page: 1, limit: 20, search: '', role: undefined }),
    useNavigate: vi.fn().mockReturnValue(vi.fn()),
  })),
}));

// Mock server users
vi.mock('@/server/users', () => ({
  listUsers: vi.fn(),
  deleteUser: vi.fn(),
  generateSetupLink: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
}));

// Mock server templates
vi.mock('@/server/templates', () => ({
  listTemplates: vi.fn(),
  createTemplate: vi.fn(),
  getTemplate: vi.fn(),
  updateTemplate: vi.fn(),
  deleteTemplate: vi.fn(),
  duplicateTemplate: vi.fn(),
}));

// Mock __root
vi.mock('@/routes/__root', () => ({
  useI18n: vi.fn().mockReturnValue({
    t: vi.fn().mockImplementation((key: string) => key),
    locale: 'en',
    setLocale: vi.fn(),
  }),
}));

// Mock UI components
vi.mock('@/components/admin/users/UserTable', () => ({
  UserTable: vi.fn().mockReturnValue(null),
}));

vi.mock('@/components/admin/users/UserFilters', () => ({
  UserFilters: vi.fn().mockReturnValue(null),
}));

vi.mock('@/components/admin/users/CreateUserDialog', () => ({
  CreateUserDialog: vi.fn().mockReturnValue(null),
}));

vi.mock('@/components/admin/users/EditUserSheet', () => ({
  EditUserSheet: vi.fn().mockReturnValue(null),
}));

vi.mock('@/components/ui/button', () => ({
  Button: vi.fn().mockReturnValue(null),
}));

vi.mock('lucide-react', () => ({
  Plus: vi.fn().mockReturnValue(null),
  RefreshCcw: vi.fn().mockReturnValue(null),
}));

vi.mock('@/components/admin/templates/TemplateCard', () => ({
  TemplateCard: vi.fn().mockReturnValue(null),
}));

vi.mock('@/components/admin/templates/TemplateFilters', () => ({
  TemplateFilters: vi.fn().mockReturnValue(null),
}));

vi.mock('@/components/admin/templates/TemplatePagination', () => ({
  TemplatePagination: vi.fn().mockReturnValue(null),
}));

vi.mock('@/components/admin/templates/TemplateEmptyState', () => ({
  TemplateEmptyState: vi.fn().mockReturnValue(null),
}));

vi.mock('@/components/admin/templates/TemplateLoadingSkeleton', () => ({
  TemplateLoadingSkeleton: vi.fn().mockReturnValue(null),
}));

vi.mock('@/components/admin/templates/CreateTemplateDialog', () => ({
  CreateTemplateDialog: vi.fn().mockReturnValue(null),
}));

vi.mock('@/components/admin/templates/EditTemplateSheet', () => ({
  EditTemplateSheet: vi.fn().mockReturnValue(null),
}));

vi.mock('@/components/admin/templates/DeleteTemplateDialog', () => ({
  DeleteTemplateDialog: vi.fn().mockReturnValue(null),
}));

describe('Admin Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Users Page', () => {
    it('should export Route', async () => {
      const { Route } = await import('@/routes/_authenticated/admin/users/index');
      expect(Route).toBeDefined();
    });

    it('should have validateSearch in route config', async () => {
      const { Route } = await import('@/routes/_authenticated/admin/users/index');
      expect(Route).toHaveProperty('validateSearch');
    });

    it('should have loader in route config', async () => {
      const { Route } = await import('@/routes/_authenticated/admin/users/index');
      expect(Route).toHaveProperty('loader');
    });

    it('should have component in route config', async () => {
      const { Route } = await import('@/routes/_authenticated/admin/users/index');
      expect(Route).toHaveProperty('component');
    });
  });

  describe('Templates Page', () => {
    it('should export Route', async () => {
      const { Route } = await import('@/routes/_authenticated/admin/templates/index');
      expect(Route).toBeDefined();
    });

    it('should have validateSearch in route config', async () => {
      const { Route } = await import('@/routes/_authenticated/admin/templates/index');
      expect(Route).toHaveProperty('validateSearch');
    });

    it('should have loader in route config', async () => {
      const { Route } = await import('@/routes/_authenticated/admin/templates/index');
      expect(Route).toHaveProperty('loader');
    });

    it('should have component in route config', async () => {
      const { Route } = await import('@/routes/_authenticated/admin/templates/index');
      expect(Route).toHaveProperty('component');
    });

    it('should have pendingComponent in route config', async () => {
      const { Route } = await import('@/routes/_authenticated/admin/templates/index');
      expect(Route).toHaveProperty('pendingComponent');
    });
  });
});
