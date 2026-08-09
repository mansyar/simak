import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import type { ReportType } from '@/lib/reporting-policy';

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({ t: (key: string) => key, locale: 'en', setLocale: vi.fn() }),
}));

vi.mock('@/server/reporting', () => ({
  getReportCatalog: vi.fn(),
  requestReport: vi.fn(),
}));

vi.mock('@/server/users', () => ({
  listUsers: vi.fn(),
}));

import { ReportCatalogControls } from '@/components/reporting/ReportCatalogControls';
import { getReportCatalog, requestReport } from '@/server/reporting';
import { listUsers } from '@/server/users';

const emptyFilters = { terms: [], courses: [], sections: [], cohorts: [] };

function catalog(reports: ReportType[]) {
  return { reports, filters: emptyFilters };
}

function renderWithQuery(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('ReportCatalogControls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listUsers).mockResolvedValue({ users: [], total: 0 });
  });

  it('renders the admin catalog with all three report types', async () => {
    vi.mocked(getReportCatalog).mockResolvedValue(
      catalog(['institutional_academic_summary', 'official_transcript', 'analytics_summary']),
    );
    renderWithQuery(<ReportCatalogControls role="admin" />);

    expect(await screen.findByText('reports.subtitle.admin')).toBeDefined();
    expect(
      await screen.findByText('reports.types.institutional_academic_summary.name'),
    ).toBeDefined();
    expect(screen.getByText('reports.types.official_transcript.name')).toBeDefined();
    expect(screen.getByText('reports.types.analytics_summary.name')).toBeDefined();
  });

  it('renders only the student transcript card for students', async () => {
    vi.mocked(getReportCatalog).mockResolvedValue(catalog(['official_transcript']));
    renderWithQuery(<ReportCatalogControls role="student" />);

    expect(await screen.findByText('reports.types.official_transcript.name')).toBeDefined();
    expect(screen.getByText('reports.subtitle.student')).toBeDefined();
    expect(screen.queryByText('reports.types.analytics_summary.name')).toBeNull();
    expect(screen.queryByText('reports.types.institutional_academic_summary.name')).toBeNull();
  });

  it('renders a skeleton loading state while the catalog loads', () => {
    vi.mocked(getReportCatalog).mockReturnValue(new Promise(() => {}));
    const { container } = renderWithQuery(<ReportCatalogControls role="admin" />);

    expect(screen.getByText('reports.loading')).toBeDefined();
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });

  it('renders an error state with retry when the catalog fails', async () => {
    vi.mocked(getReportCatalog).mockResolvedValue({ error: { code: 'INTERNAL', message: 'boom' } });
    renderWithQuery(<ReportCatalogControls role="admin" />);

    expect(await screen.findByRole('alert')).toBeDefined();
    expect(screen.getByText('error.internal')).toBeDefined();
    expect(screen.getByRole('button', { name: 'common.retry' })).toBeDefined();
  });

  it('renders an empty state when no reports are available', async () => {
    vi.mocked(getReportCatalog).mockResolvedValue(catalog([]));
    renderWithQuery(<ReportCatalogControls role="admin" />);

    expect(await screen.findByText('reports.empty')).toBeDefined();
  });

  it('refetches the catalog when the error retry button is clicked', async () => {
    vi.mocked(getReportCatalog)
      .mockResolvedValueOnce({ error: { code: 'INTERNAL', message: 'boom' } })
      .mockResolvedValueOnce(catalog(['analytics_summary']));
    renderWithQuery(<ReportCatalogControls role="instructor" />);

    (await screen.findByRole('button', { name: 'common.retry' })).click();
    expect(await screen.findByText('reports.types.analytics_summary.name')).toBeDefined();
    expect(getReportCatalog).toHaveBeenCalledTimes(2);
  });

  it('does not trigger report generation from the container itself', async () => {
    vi.mocked(getReportCatalog).mockResolvedValue(catalog(['analytics_summary']));
    renderWithQuery(<ReportCatalogControls role="instructor" />);

    await screen.findByText('reports.types.analytics_summary.name');
    expect(requestReport).not.toHaveBeenCalled();
  });
});
