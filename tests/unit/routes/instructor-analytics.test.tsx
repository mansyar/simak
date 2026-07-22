/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ComponentType } from 'react';
import { exportToExcel } from '@/lib/excel-export';

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
  useLocation: () => ({ pathname: '/instructor/analytics' }),
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

vi.mock('@/lib/excel-export', () => ({
  exportToExcel: vi.fn(),
}));

const mockAnalyticsData = {
  reviewsCompleted: 42,
  averageResponseTimeHours: 3.5,
  slaBreachCount: 3,
  studentsSupervised: 15,
  assignmentsActive: 8,
  dateRange: { start: null, end: null },
};

async function getAnalyticsPage(): Promise<ComponentType> {
  const mod = await import('@/routes/_authenticated/instructor/analytics');
  return (mod.Route as any).component ?? (mod.Route as any).Component;
}

describe('Instructor Analytics Page', () => {
  beforeEach(() => {
    mocks.loaderData = { ...mockAnalyticsData };
    mocks.search = { range: '30d', start: undefined, end: undefined };
    mocks.navigate.mockClear();
  });

  it('renders page header with title and subtitle', async () => {
    const Page = await getAnalyticsPage();
    render(<Page />);
    expect(screen.getByText('instructorAnalytics.title')).toBeDefined();
    expect(screen.getByText('instructorAnalytics.subtitle')).toBeDefined();
  });

  it('renders MetricCards with correct values', async () => {
    const Page = await getAnalyticsPage();
    render(<Page />);
    expect(screen.getByText('42')).toBeDefined();
    expect(screen.getByText('3.5h')).toBeDefined();
    expect(screen.getByText('3')).toBeDefined();
    expect(screen.getByText('15')).toBeDefined();
    expect(screen.getByText('8')).toBeDefined();
    expect(screen.getByText('instructorAnalytics.reviewsCompleted')).toBeDefined();
    expect(screen.getByText('instructorAnalytics.avgResponseTime')).toBeDefined();
    expect(screen.getByText('instructorAnalytics.slaBreachCount')).toBeDefined();
    expect(screen.getByText('instructorAnalytics.studentsSupervised')).toBeDefined();
    expect(screen.getByText('instructorAnalytics.assignmentsActive')).toBeDefined();
  });

  it('renders N/A for null average response time', async () => {
    mocks.loaderData = { ...mockAnalyticsData, averageResponseTimeHours: null };
    const Page = await getAnalyticsPage();
    render(<Page />);
    expect(screen.getByText('N/A')).toBeDefined();
  });

  it('renders date range selector buttons', async () => {
    const Page = await getAnalyticsPage();
    render(<Page />);
    expect(screen.getByText('instructorAnalytics.range7d')).toBeDefined();
    expect(screen.getByText('instructorAnalytics.range30d')).toBeDefined();
    expect(screen.getByText('instructorAnalytics.range90d')).toBeDefined();
    expect(screen.getByText('instructorAnalytics.rangeAll')).toBeDefined();
  });

  it('navigates when a range button is clicked', async () => {
    const Page = await getAnalyticsPage();
    render(<Page />);
    fireEvent.click(screen.getByText('instructorAnalytics.range7d'));
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
    expect(screen.getByLabelText('instructorAnalytics.customStart')).toBeDefined();
    expect(screen.getByLabelText('instructorAnalytics.customEnd')).toBeDefined();
  });

  it('renders error state when server returns error', async () => {
    mocks.loaderData = { error: { code: 'INTERNAL', message: 'Internal Server Error' } };
    const Page = await getAnalyticsPage();
    render(<Page />);
    expect(screen.getByText('Internal Server Error')).toBeDefined();
  });

  it('renders Export Excel button', async () => {
    const Page = await getAnalyticsPage();
    render(<Page />);
    expect(screen.getByText('common.exportExcel')).toBeDefined();
  });

  it('calls exportToExcel when Export Excel button is clicked', async () => {
    vi.mocked(exportToExcel).mockClear();
    const Page = await getAnalyticsPage();
    render(<Page />);
    fireEvent.click(screen.getByText('common.exportExcel'));
    expect(exportToExcel).toHaveBeenCalledTimes(1);
    expect(exportToExcel).toHaveBeenCalledWith(
      expect.any(Array),
      'Instructor Analytics',
      'instructor-analytics.xlsx',
    );
  });
});

describe('Instructor Sidebar Analytics Entry', () => {
  it('renders analytics link in sidebar', async () => {
    const { InstructorSidebar } = await import('@/components/layout/instructor-sidebar');
    render(<InstructorSidebar isOpen={false} onClose={() => {}} />);
    expect(screen.getByText('instructorSidebar.analytics')).toBeDefined();
  });
});
