/**
 * Tests: admin settings route renders the page header via <PageHeader>.
 * Mirrors the admin-dashboard.test.tsx pattern.
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
    useSearch: vi.fn().mockReturnValue({}),
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

// Heavy child component – stub so we can isolate the header
vi.mock('@/components/settings/SettingsPage', () => ({
  SettingsPage: () => <div data-testid="settings-page" />,
}));

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

const CANONICAL_CLASSES = ['font-display', 'text-3xl', 'text-foreground'];

describe('Admin Settings Route', () => {
  it('should export route from admin settings module', async () => {
    const mod = await import('@/routes/_authenticated/admin/settings');
    expect(mod).toHaveProperty('Route');
  });

  it('should have component defined for admin settings', async () => {
    const mod = await import('@/routes/_authenticated/admin/settings');
    const Component = (mod.Route as any).component ?? (mod.Route as any).Component;
    expect(Component).toBeDefined();
  });

  it('renders h1 with canonical PageHeader classes (text-3xl, not text-4xl)', async () => {
    const mod = await import('@/routes/_authenticated/admin/settings');
    const Component = (mod.Route as any).component ?? (mod.Route as any).Component;
    render(<Component />);
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveClass(...CANONICAL_CLASSES);
  });

  it('renders the title from t("settings.title")', async () => {
    const mod = await import('@/routes/_authenticated/admin/settings');
    const Component = (mod.Route as any).component ?? (mod.Route as any).Component;
    render(<Component />);
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent('settings.title');
  });

  it('does not use the old text-4xl heading scale', async () => {
    const mod = await import('@/routes/_authenticated/admin/settings');
    const Component = (mod.Route as any).component ?? (mod.Route as any).Component;
    render(<Component />);
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).not.toHaveClass('text-4xl');
  });
});
