import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import type { ReportHistoryJob } from '@/lib/reporting-history';

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({ t: (key: string) => key, locale: 'en', setLocale: vi.fn() }),
}));

vi.mock('@/server/reporting', () => ({
  downloadReport: vi.fn(),
  getReportHistory: vi.fn(),
  retryReport: vi.fn(),
}));

import { ReportHistory } from '@/components/reporting/ReportHistory';
import { getReportHistory, retryReport } from '@/server/reporting';

function job(overrides: Partial<ReportHistoryJob> = {}): ReportHistoryJob {
  return {
    id: 7,
    reportType: 'analytics_summary',
    locale: 'en',
    state: 'completed',
    createdAt: new Date('2026-08-10T10:00:00Z'),
    completedAt: new Date('2026-08-10T10:05:00Z'),
    failedAt: null,
    expiresAt: new Date('2026-09-09T10:00:00Z'),
    ...overrides,
  };
}

function renderWithQuery(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('ReportHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getReportHistory).mockResolvedValue({ jobs: [] });
    vi.mocked(retryReport).mockResolvedValue({
      job: { ...job(), state: 'completed' },
    });
  });

  it('renders a loading state with skeletons while the history loads', () => {
    vi.mocked(getReportHistory).mockReturnValue(new Promise(() => {}));
    const { container } = renderWithQuery(<ReportHistory role="admin" />);

    expect(screen.getByText('reports.history.loading')).toBeDefined();
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });

  it('renders an empty state when there are no jobs', async () => {
    renderWithQuery(<ReportHistory role="admin" />);

    expect(await screen.findByText('reports.history.empty')).toBeDefined();
    expect(screen.getByText('reports.history.emptyDescription')).toBeDefined();
  });

  it('renders an error state with a retry action when the history fails', async () => {
    const user = userEvent.setup();
    vi.mocked(getReportHistory)
      .mockResolvedValueOnce({ error: { code: 'INTERNAL', message: 'boom' } })
      .mockResolvedValueOnce({ jobs: [job()] });

    renderWithQuery(<ReportHistory role="admin" />);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('reports.history.loadError');

    await user.click(screen.getByRole('button', { name: 'common.retry' }));

    expect(await screen.findByText('reports.types.analytics_summary.name')).toBeDefined();
    expect(getReportHistory).toHaveBeenCalledTimes(2);
  });

  it('lists jobs with their state labels and metadata', async () => {
    vi.mocked(getReportHistory).mockResolvedValue({
      jobs: [
        job({ id: 1, reportType: 'official_transcript', state: 'completed' }),
        job({ id: 2, state: 'pending', completedAt: null, expiresAt: null }),
        job({ id: 3, state: 'failed', completedAt: null, expiresAt: null }),
        job({ id: 4, state: 'expired', completedAt: null, expiresAt: null }),
      ],
    });

    renderWithQuery(<ReportHistory role="admin" />);

    expect(await screen.findByText('reports.types.official_transcript.name')).toBeDefined();
    expect(screen.getByText('reports.history.state.completed')).toBeDefined();
    expect(screen.getByText('reports.history.state.pending')).toBeDefined();
    expect(screen.getByText('reports.history.state.failed')).toBeDefined();
    expect(screen.getByText('reports.history.state.expired')).toBeDefined();
    expect(screen.getAllByRole('button', { name: 'reports.history.download' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'reports.history.retry' })).toHaveLength(1);
  });

  it('refetches history when a failed job is retried', async () => {
    const user = userEvent.setup();
    vi.mocked(getReportHistory)
      .mockResolvedValueOnce({
        jobs: [job({ state: 'failed', completedAt: null, expiresAt: null })],
      })
      .mockResolvedValueOnce({ jobs: [job({ state: 'completed' })] });

    renderWithQuery(<ReportHistory role="admin" />);

    await user.click(await screen.findByRole('button', { name: 'reports.history.retry' }));

    expect(retryReport).toHaveBeenCalledWith({ data: { jobId: 7 } });
    expect(await screen.findByText('reports.history.state.completed')).toBeDefined();
    expect(getReportHistory).toHaveBeenCalledTimes(2);
  });

  it('announces job state changes via a polite live region', async () => {
    vi.mocked(getReportHistory).mockResolvedValue({
      jobs: [
        job({
          id: 1,
          reportType: 'official_transcript',
          state: 'processing',
          completedAt: null,
          expiresAt: null,
        }),
      ],
    });

    renderWithQuery(<ReportHistory role="admin" />);

    await screen.findByText('reports.types.official_transcript.name');
    const liveRegion = screen.getByRole('status');
    expect(liveRegion.getAttribute('aria-live')).toBe('polite');
  });
});
