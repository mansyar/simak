import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Hoisted mock for router
const mockRouter = vi.hoisted(() => ({ invalidate: vi.fn() }));

// Mock @tanstack/react-router
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: vi
    .fn()
    .mockImplementation((_path: string) => (config: Record<string, unknown>) => ({
      ...config,
      useLoaderData: vi.fn().mockReturnValue({ templates: [], total: 0 }),
      useSearch: vi.fn().mockReturnValue({ page: 1, limit: 20, search: '', type: '' }),
      useNavigate: vi.fn().mockReturnValue(vi.fn()),
    })),
  useRouter: vi.fn().mockReturnValue(mockRouter),
  Link: ({ children, to }: { children: React.ReactNode; to?: string }) => (
    <a href={to}>{children}</a>
  ),
}));

// Mock @tanstack/react-start
vi.mock('@tanstack/react-start', () => ({
  useServerFn: vi.fn().mockImplementation((fn: unknown) => fn),
}));

// Mock server functions
vi.mock('@/server/templates', () => ({
  listTemplates: vi.fn(),
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
  TemplateFilters: () => null,
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
});
