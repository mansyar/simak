/**
 * Tests: admin dashboard route renders the page header via <PageHeader>.
 * Mirrors the instructor-page-headers.test.tsx pattern.
 *
 * The mock useI18n returns `t: (key) => key`, so rendered text equals the i18n key.
 */
/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

/* ------------------------------------------------------------------ */
/*  Mocks                                                             */
/* ------------------------------------------------------------------ */

// TanStack Router
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
  createFileRoute: vi.fn().mockImplementation((_path: string) => (config: any) => ({
    ...config,
    useLoaderData: vi.fn().mockReturnValue({}),
    useSearch: vi.fn().mockReturnValue({ page: 1, limit: 20, search: '' }),
    useNavigate: vi.fn().mockReturnValue(vi.fn()),
    useParams: vi.fn().mockReturnValue({}),
  })),
}));

// i18n
vi.mock('@/routes/__root', () => ({
  useI18n: vi.fn().mockReturnValue({
    t: vi.fn().mockImplementation((key: string) => key),
    locale: 'en',
    setLocale: vi.fn(),
  }),
}));

// Server functions
vi.mock('@/server/dashboard', () => ({
  getAdminDashboardData: vi.fn(),
}));

// Heavy child component – stub so we can isolate the header
vi.mock('@/components/dashboard/AdminDashboard', () => ({
  AdminDashboard: () => <div data-testid="admin-dashboard" />,
}));

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

const CANONICAL_CLASSES = ['font-display', 'text-3xl', 'text-foreground'];

describe('Admin Dashboard route', () => {
  it('should export route from admin dashboard module', async () => {
    const mod = await import('@/routes/_authenticated/admin/dashboard');
    expect(mod).toHaveProperty('Route');
  });

  it('renders h1 with canonical PageHeader classes (text-3xl, not text-4xl)', async () => {
    const mod = await import('@/routes/_authenticated/admin/dashboard');
    const Component = (mod.Route as any).component ?? (mod.Route as any).Component;
    render(<Component />);
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveClass(...CANONICAL_CLASSES);
  });

  it('renders the title from t("adminDashboard.title")', async () => {
    const mod = await import('@/routes/_authenticated/admin/dashboard');
    const Component = (mod.Route as any).component ?? (mod.Route as any).Component;
    render(<Component />);
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent('adminDashboard.title');
  });

  it('renders the subtitle from t("adminDashboard.subtitle")', async () => {
    const mod = await import('@/routes/_authenticated/admin/dashboard');
    const Component = (mod.Route as any).component ?? (mod.Route as any).Component;
    render(<Component />);
    expect(screen.getByText('adminDashboard.subtitle')).toBeInTheDocument();
  });

  it('does not use the old text-4xl heading scale', async () => {
    const mod = await import('@/routes/_authenticated/admin/dashboard');
    const Component = (mod.Route as any).component ?? (mod.Route as any).Component;
    render(<Component />);
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).not.toHaveClass('text-4xl');
  });
});
