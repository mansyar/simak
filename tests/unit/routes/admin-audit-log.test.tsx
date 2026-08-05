/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { ComponentType } from 'react';

const mockRouter = vi.hoisted(() => ({
  invalidate: vi.fn(),
}));
const mockNavigate = vi.hoisted(() => vi.fn());

const mockLoaderData = vi.hoisted(() => ({
  value: { entries: [], total: 100, page: 1, limit: 50 },
}));

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
    useLoaderData: vi.fn().mockImplementation(() => mockLoaderData.value),
    useSearch: vi.fn().mockReturnValue({
      page: 1,
      limit: 50,
      action: '',
      dateFrom: '',
      dateTo: '',
      search: '',
    }),
    useNavigate: vi.fn().mockReturnValue(mockNavigate),
  })),
  useRouter: vi.fn().mockReturnValue(mockRouter),
}));

// Mock server audit-log
vi.mock('@/server/audit-log', () => ({
  listAuditLogs: vi.fn(),
  getAuditLogDetail: vi.fn(),
}));

// Mock __root
vi.mock('@/routes/__root', () => ({
  useI18n: vi.fn().mockReturnValue({
    t: vi.fn().mockImplementation((key: string) => key),
    locale: 'en',
    setLocale: vi.fn(),
  }),
}));

async function getComponent(): Promise<ComponentType> {
  const mod = await import('@/routes/_authenticated/admin/audit-log');
  return (mod.Route as any).component ?? (mod.Route as any).Component;
}

describe('Admin Audit Log page', () => {
  beforeEach(() => {
    mockLoaderData.value = { entries: [], total: 100, page: 1, limit: 50 };
    mockRouter.invalidate.mockClear();
    mockNavigate.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should export a route component', async () => {
    const mod = await import('@/routes/_authenticated/admin/audit-log');
    expect(mod).toBeDefined();
    expect(mod.Route).toBeDefined();
  });

  it('should have Route with component defined', async () => {
    const mod = await import('@/routes/_authenticated/admin/audit-log');
    expect(mod.Route).toBeDefined();
    expect(typeof mod.Route).toBe('object');
  });

  it('should use listAuditLogs server function', async () => {
    const { listAuditLogs } = await import('@/server/audit-log');
    expect(typeof listAuditLogs).toBe('function');
  });

  describe('render', () => {
    it('should render the page title via PageHeader (text-3xl, not text-4xl)', async () => {
      const Component = await getComponent();
      render(<Component />);
      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toHaveClass('font-display', 'text-3xl', 'text-foreground');
      expect(heading).not.toHaveClass('text-4xl');
      expect(heading.textContent).toBe('adminAuditLog.title');
    });

    it('should render the page subtitle', async () => {
      const Component = await getComponent();
      render(<Component />);
      const subtitle = screen.getByText('adminAuditLog.subtitle');
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

    it('should show a retryable error state instead of an empty audit log', async () => {
      mockLoaderData.value = {
        error: { code: 'INTERNAL', message: 'database details' },
      } as never;
      const Component = await getComponent();
      render(<Component />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('error.internal')).toBeInTheDocument();
      expect(screen.queryByText('database details')).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'common.refresh' }));
      expect(mockRouter.invalidate).toHaveBeenCalledTimes(1);
    });

    it('should use Pagination component with common.back/common.next buttons and common.pageOf counter', async () => {
      const Component = await getComponent();
      render(<Component />);
      // Pagination renders common.back for prev (not common.previous)
      expect(screen.getByText('common.back')).toBeInTheDocument();
      // Pagination renders common.next for next
      expect(screen.getByText('common.next')).toBeInTheDocument();
      // Pagination renders common.pageOf for counter (not adminAuditLog.showing)
      expect(screen.getByText('common.pageOf')).toBeInTheDocument();
      // Old hand-rolled text should be gone
      expect(screen.queryByText('common.previous')).not.toBeInTheDocument();
      expect(screen.queryByText('adminAuditLog.showing')).not.toBeInTheDocument();
    });

    it('should use Select primitive for action filter (data-slot="select-trigger")', async () => {
      const Component = await getComponent();
      const { container } = render(<Component />);
      // SelectTrigger renders data-slot="select-trigger"
      const selectTrigger = container.querySelector('[data-slot="select-trigger"]');
      expect(selectTrigger).toBeTruthy();
      // Raw <select> should not be present
      expect(container.querySelector('select')).toBeNull();
    });

    it('should expose labeled filters and mobile-safe table semantics', async () => {
      const Component = await getComponent();
      const { container } = render(<Component />);
      expect(
        screen.getByRole('textbox', { name: 'adminAuditLog.searchLabel' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('combobox', { name: 'adminAuditLog.actionFilterLabel' }),
      ).toBeInTheDocument();
      expect(screen.getByLabelText('adminAuditLog.dateFrom')).toBeInTheDocument();
      expect(screen.getByLabelText('adminAuditLog.dateTo')).toBeInTheDocument();
      const table = container.querySelector('table');
      expect(table?.querySelector('caption')?.textContent).toContain(
        'adminAuditLog.auditTable.caption',
      );
      expect(
        Array.from(table?.querySelectorAll('th') ?? []).every((head) => head.scope === 'col'),
      ).toBe(true);
      expect(table?.className).toMatch(/block/);
      expect(table?.querySelector('tbody tr')?.className).toMatch(/md:table-row/);
    });

    it('should wrap the audit log table in a Card primitive', async () => {
      const Component = await getComponent();
      const { container } = render(<Component />);
      // Card renders data-slot="card"
      const card = container.querySelector('[data-slot="card"]');
      expect(card).toBeTruthy();
      // The table should be inside the card
      const table = card?.querySelector('table');
      expect(table).toBeTruthy();
    });
  });

  describe('pendingComponent', () => {
    it('should have pendingComponent in route config', async () => {
      const mod = await import('@/routes/_authenticated/admin/audit-log');
      expect(mod.Route).toHaveProperty('pendingComponent');
    });
  });

  it('does not navigate per keystroke and resets the page after the debounce', async () => {
    vi.useFakeTimers();
    const Component = await getComponent();
    render(<Component />);
    const searchInput = screen.getByPlaceholderText('adminAuditLog.searchPlaceholder');

    fireEvent.change(searchInput, { target: { value: 'draft' } });
    expect(mockNavigate).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    const options = mockNavigate.mock.calls[0]?.[0] as {
      search: (previous: { page: number; search: string }) => { page: number; search: string };
    };
    expect(options.search({ page: 3, search: '' })).toMatchObject({ page: 1, search: 'draft' });
  });
});
