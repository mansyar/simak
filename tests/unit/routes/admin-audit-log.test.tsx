/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { ComponentType } from 'react';

const mockRouter = vi.hoisted(() => ({
  invalidate: vi.fn(),
}));

// Mock @tanstack/react-start/server
vi.mock('@tanstack/react-start/server', () => ({
  getRequestHeaders: vi.fn().mockReturnValue(new Headers()),
}));

// Mock @tanstack/react-start
vi.mock('@tanstack/react-start', () => ({
  createServerFn: vi.fn().mockReturnValue({
    inputValidator: vi.fn().mockReturnThis(),
    handler: vi.fn().mockImplementation((fn) => fn),
  }),
}));

// Mock @tanstack/react-router
vi.mock('@tanstack/react-router', () => ({
  redirect: vi.fn().mockImplementation((opts) => {
    throw new Error(`REDIRECT: ${opts.to}`);
  }),
  createFileRoute: vi.fn().mockReturnValue((config: any) => ({
    ...config,
    useLoaderData: vi.fn().mockReturnValue({
      entries: [],
      total: 0,
      page: 1,
      limit: 50,
    }),
    useSearch: vi.fn().mockReturnValue({
      page: 1,
      limit: 50,
      action: '',
      dateFrom: '',
      dateTo: '',
      search: '',
    }),
    useNavigate: vi.fn().mockReturnValue(vi.fn()),
  })),
  useRouter: vi.fn().mockReturnValue(mockRouter),
}));

// Mock server audit-logs
vi.mock('@/server/audit-logs', () => ({
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
    const { listAuditLogs } = await import('@/server/audit-logs');
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
  });
});
