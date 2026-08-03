import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Hoisted mock for router
const mockRouter = vi.hoisted(() => ({ invalidate: vi.fn() }));
const mockNavigate = vi.hoisted(() => vi.fn());
const mockTemplateTypes = vi.hoisted(() => ({ current: ['Thesis', 'Project', 'Dissertation'] }));
const mockQueryClient = vi.hoisted(() => ({ invalidateQueries: vi.fn() }));

// Hoisted mock for loader data (changeable per test)
const mockLoaderData = vi.hoisted(() => ({
  current: { templates: [] as any[], total: 0, allTypes: [] as string[] } as any,
}));

// Mock @tanstack/react-router
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: vi
    .fn()
    .mockImplementation((_path: string) => (config: Record<string, unknown>) => ({
      ...config,
      useLoaderData: vi.fn().mockImplementation(() => mockLoaderData.current),
      useSearch: vi.fn().mockReturnValue({ page: 1, limit: 20, search: '', type: '' }),
      useNavigate: vi.fn().mockReturnValue(mockNavigate),
    })),
  useRouter: vi.fn().mockReturnValue(mockRouter),
  Link: ({ children, to }: { children: React.ReactNode; to?: string }) => (
    <a href={to}>{children}</a>
  ),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn().mockImplementation(() => ({ data: { types: mockTemplateTypes.current } })),
  useQueryClient: vi.fn().mockReturnValue(mockQueryClient),
}));

// Mock @tanstack/react-start
vi.mock('@tanstack/react-start', () => ({
  useServerFn: vi.fn().mockImplementation((fn: unknown) => fn),
}));

// Mock server functions
vi.mock('@/server/templates', () => ({
  listTemplates: vi.fn(),
  listTemplateTypes: vi.fn(),
  createTemplate: vi.fn(),
  getTemplate: vi.fn(),
  deleteTemplate: vi.fn(),
  duplicateTemplate: vi.fn(),
}));

// Mock i18n
vi.mock('@/routes/__root', () => ({
  useI18n: () => ({ t: (key: string) => key, locale: 'en' }),
}));

// Mock child components as stubs
vi.mock('@/components/admin/templates/TemplateCard', () => ({
  TemplateCard: () => null,
  TemplateRow: {},
}));

vi.mock('@/components/admin/templates/TemplateFilters', () => ({
  TemplateFilters: (props: any) => (
    <div data-testid="template-filters" data-types={JSON.stringify(props.types)}>
      <button
        type="button"
        data-testid="template-search-commit"
        onClick={() => props.onSearchChange('draft')}
      />
    </div>
  ),
}));

vi.mock('@/components/ui/pagination', () => ({
  Pagination: () => null,
}));

vi.mock('@/components/admin/templates/TemplateEmptyState', () => ({
  TemplateEmptyState: () => null,
}));

vi.mock('@/components/admin/templates/TemplateLoadingSkeleton', () => ({
  TemplateLoadingSkeleton: () => null,
}));

vi.mock('@/components/admin/templates/CreateTemplateDialog', () => ({
  CreateTemplateDialog: () => null,
}));

vi.mock('@/components/admin/templates/DeleteTemplateDialog', () => ({
  DeleteTemplateDialog: () => null,
}));

async function getComponent() {
  const mod = await import('@/routes/_authenticated/admin/templates/index');
  return (mod.Route as any).component ?? (mod.Route as any).Component;
}

describe('Admin Templates Index Route', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('resets the page when the filter commits a search value', async () => {
    const Component = await getComponent();
    render(<Component />);

    fireEvent.click(screen.getByTestId('template-search-commit'));

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    const options = mockNavigate.mock.calls[0]?.[0] as {
      search: (previous: { page: number; search: string }) => { page: number; search: string };
    };
    expect(options.search({ page: 3, search: '' })).toMatchObject({ page: 1, search: 'draft' });
  });

  it('should have Route defined', async () => {
    const mod = await import('@/routes/_authenticated/admin/templates/index');
    expect(mod.Route).toBeDefined();
  });

  it('should have component defined', async () => {
    const Component = await getComponent();
    expect(Component).toBeDefined();
  });

  it('should render the page title with canonical h1 classes', async () => {
    const Component = await getComponent();
    render(<Component />);
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent('adminTemplates.title');
    expect(h1).toHaveClass('font-display');
    expect(h1).toHaveClass('text-3xl');
    expect(h1).toHaveClass('text-foreground');
    expect(h1).not.toHaveClass('text-4xl');
  });

  it('should render the subtitle', async () => {
    const Component = await getComponent();
    render(<Component />);
    expect(screen.getByText('adminTemplates.subtitle')).toBeInTheDocument();
  });

  it('should call router.invalidate when refresh button is clicked', async () => {
    const Component = await getComponent();
    render(<Component />);
    const refreshButton = screen.getByRole('button', {
      name: 'common.refresh',
    });
    await fireEvent.click(refreshButton);
    expect(mockRouter.invalidate).toHaveBeenCalled();
  });

  it('should render an icon-only refresh button (no text label)', async () => {
    const Component = await getComponent();
    render(<Component />);
    const refreshButton = screen.getByRole('button', {
      name: 'common.refresh',
    });
    expect(refreshButton.textContent?.trim()).toBe('');
  });

  it('should render the "New Template" button', async () => {
    const Component = await getComponent();
    render(<Component />);
    expect(screen.getByRole('button', { name: /adminTemplates.newTemplate/ })).toBeInTheDocument();
  });

  it('should pass allTypes from server to TemplateFilters (not computed from templates)', async () => {
    // The independently cached type query returns 3 types while the list has only 1 template.
    mockTemplateTypes.current = ['Thesis', 'Project', 'Dissertation'];
    mockLoaderData.current = {
      templates: [{ type: 'Thesis' }],
      total: 1,
    };
    const Component = await getComponent();
    render(<Component />);
    const filters = screen.getByTestId('template-filters');
    const types = JSON.parse(filters.getAttribute('data-types') || '[]');
    // Should receive all 3 types from the independent query, not from the templates array.
    expect(types).toEqual(['Thesis', 'Project', 'Dissertation']);
    // Reset
    mockLoaderData.current = { templates: [], total: 0 };
  });
});
