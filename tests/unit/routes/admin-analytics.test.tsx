/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ComponentType } from 'react';

const mocks = vi.hoisted(() => ({
  loaderData: {} as any,
  search: {
    range: '30d' as string | undefined,
    start: undefined as string | undefined,
    end: undefined as string | undefined,
  },
  navigate: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (config: any) => ({
    ...config,
    useLoaderData: () => mocks.loaderData,
    useSearch: () => mocks.search,
    useNavigate: () => mocks.navigate,
  }),
  useLocation: () => ({ pathname: '/admin/analytics' }),
  Link: ({ children, to, ...props }: any) => (
    <a href={String(to)} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ invalidate: vi.fn() }),
}));

vi.mock('@tanstack/react-start', () => ({
  createServerFn: vi.fn().mockReturnValue({
    inputValidator: vi.fn().mockReturnThis(),
    handler: vi.fn().mockImplementation((fn) => fn),
  }),
}));

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({ t: (key: string) => key, locale: 'en' }),
}));

vi.mock('@/lib/auth-client', () => ({
  authClient: {
    useSession: () => ({ data: null }),
    signOut: vi.fn(),
  },
}));

vi.mock('@/components/skeletons/dashboard-skeleton', () => ({
  DashboardSkeleton: () => <div data-testid="dashboard-skeleton" />,
}));

const mockAnalyticsData = {
  consultationVerificationRate: 85,
  deadlineBreachRate: 12,
  statusDistribution: [
    { state: 'locked', count: 10 },
    { state: 'passed', count: 15 },
  ],
  submissionTrend: [{ date: '2024-01-01', count: 105 }],
  reviewTrend: [{ date: '2024-01-02', count: 203 }],
  reviewsCompleted: 42,
  dauTrend: [{ date: '2024-01-03', activeUsers: 501 }],
  wauTrend: [{ date: '2024-01-04', activeUsers: 999 }],
  dateRange: { start: null, end: null },
};

async function getAnalyticsPage(): Promise<ComponentType> {
  const mod = await import('@/routes/_authenticated/admin/analytics');
  return (mod.Route as any).component ?? (mod.Route as any).Component;
}

describe('Admin Analytics Page', () => {
  beforeEach(() => {
    mocks.loaderData = { ...mockAnalyticsData };
    mocks.search = { range: '30d', start: undefined, end: undefined };
    mocks.navigate.mockClear();
  });

  it('renders page header with title and subtitle', async () => {
    const Page = await getAnalyticsPage();
    render(<Page />);
    expect(screen.getByText('adminAnalytics.title')).toBeDefined();
    expect(screen.getByText('adminAnalytics.subtitle')).toBeDefined();
  });

  it('renders MetricCards with correct values', async () => {
    const Page = await getAnalyticsPage();
    render(<Page />);
    expect(screen.getByText('85%')).toBeDefined();
    expect(screen.getByText('12%')).toBeDefined();
    expect(screen.getByText('42')).toBeDefined();
    expect(screen.getByText('adminAnalytics.verificationRate')).toBeDefined();
    expect(screen.getByText('adminAnalytics.breachRate')).toBeDefined();
    expect(screen.getByText('adminAnalytics.reviewsCompleted')).toBeDefined();
  });

  it('renders status distribution with progress bars', async () => {
    const Page = await getAnalyticsPage();
    render(<Page />);
    expect(screen.getByText('adminAnalytics.statusDistribution')).toBeDefined();
    expect(screen.getByText('adminAnalytics.statusLocked')).toBeDefined();
    expect(screen.getByText('adminAnalytics.statusPassed')).toBeDefined();
  });

  it('renders trend tables with data rows', async () => {
    const Page = await getAnalyticsPage();
    render(<Page />);
    expect(screen.getByText('adminAnalytics.submissionTrend')).toBeDefined();
    expect(screen.getByText('adminAnalytics.reviewTrend')).toBeDefined();
    expect(screen.getByText('adminAnalytics.dauTrend')).toBeDefined();
    expect(screen.getByText('adminAnalytics.wauTrend')).toBeDefined();
    expect(screen.getByText('2024-01-01')).toBeDefined();
    expect(screen.getByText('2024-01-02')).toBeDefined();
    expect(screen.getByText('2024-01-03')).toBeDefined();
    expect(screen.getByText('2024-01-04')).toBeDefined();
  });

  it('renders date range selector buttons', async () => {
    const Page = await getAnalyticsPage();
    render(<Page />);
    expect(screen.getByText('adminAnalytics.range7d')).toBeDefined();
    expect(screen.getByText('adminAnalytics.range30d')).toBeDefined();
    expect(screen.getByText('adminAnalytics.range90d')).toBeDefined();
    expect(screen.getByText('adminAnalytics.rangeAll')).toBeDefined();
  });

  it('navigates when a range button is clicked', async () => {
    const Page = await getAnalyticsPage();
    render(<Page />);
    fireEvent.click(screen.getByText('adminAnalytics.range7d'));
    expect(mocks.navigate).toHaveBeenCalledTimes(1);
    const call = mocks.navigate.mock.calls[0][0];
    const result = call.search({ range: '30d', start: undefined, end: undefined });
    expect(result.range).toBe('7d');
    expect(result.start).toBeUndefined();
    expect(result.end).toBeUndefined();
  });

  it('renders custom date range inputs', async () => {
    const Page = await getAnalyticsPage();
    render(<Page />);
    expect(screen.getByLabelText('adminAnalytics.customStart')).toBeDefined();
    expect(screen.getByLabelText('adminAnalytics.customEnd')).toBeDefined();
  });

  it('renders error state when server returns error', async () => {
    mocks.loaderData = { error: { code: 'INTERNAL', message: 'Internal Server Error' } };
    const Page = await getAnalyticsPage();
    render(<Page />);
    expect(screen.getByText('Internal Server Error')).toBeDefined();
  });

  it('renders empty state for trends with no data', async () => {
    mocks.loaderData = {
      ...mockAnalyticsData,
      submissionTrend: [],
      reviewTrend: [],
      dauTrend: [],
      wauTrend: [],
    };
    const Page = await getAnalyticsPage();
    render(<Page />);
    const emptyStates = screen.getAllByText('adminAnalytics.noData');
    expect(emptyStates.length).toBe(4);
  });
});

describe('Admin Sidebar Analytics Entry', () => {
  it('renders analytics link in sidebar', async () => {
    const { AdminSidebar } = await import('@/components/layout/admin-sidebar');
    render(<AdminSidebar isOpen={false} onClose={() => {}} />);
    expect(screen.getByText('adminSidebar.analytics')).toBeDefined();
  });
});
