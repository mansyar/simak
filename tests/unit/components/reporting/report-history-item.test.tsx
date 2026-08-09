import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
  retryReport: vi.fn(),
}));

import { ReportHistoryItem } from '@/components/reporting/ReportHistoryItem';
import { downloadReport, retryReport } from '@/server/reporting';

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

function renderItem(item: ReportHistoryJob) {
  return renderWithQuery(<ReportHistoryItem job={item} onJobChanged={vi.fn()} />);
}

describe('ReportHistoryItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(downloadReport).mockResolvedValue({ downloadUrl: 'https://cdn.example/report.pdf' });
    vi.mocked(retryReport).mockResolvedValue({
      job: { ...job(), state: 'completed' },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the report type, request time, and state label', () => {
    renderItem(job());

    expect(screen.getByText('reports.types.analytics_summary.name')).toBeDefined();
    expect(screen.getByText('reports.history.state.completed')).toBeDefined();
    expect(screen.getByText(/reports.history.requestedLabel/)).toBeDefined();
  });

  it('shows generated and expiry metadata without internal failure details or artifact keys', () => {
    renderItem(job());

    expect(screen.getByText(/reports.history.generatedLabel/)).toBeDefined();
    expect(screen.getByText(/reports.history.expiresLabel/)).toBeDefined();
    expect(screen.queryByText(/artifact|sha256|requester/)).toBeNull();
    expect(screen.queryByText(/failureCode|failureMessage|generation_failed/)).toBeNull();
  });

  it('offers a secure download for a completed, unexpired job', async () => {
    const user = userEvent.setup();
    const openSpy = vi.fn();
    vi.stubGlobal('open', openSpy);
    renderItem(job());

    await user.click(screen.getByRole('button', { name: 'reports.history.download' }));

    expect(downloadReport).toHaveBeenCalledWith({ data: { jobId: 7 } });
    expect(openSpy).toHaveBeenCalledWith(
      'https://cdn.example/report.pdf',
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('announces a download failure via an assertive live region', async () => {
    const user = userEvent.setup();
    vi.mocked(downloadReport).mockResolvedValue({
      error: { code: 'NOT_FOUND', message: 'gone' },
    });
    renderItem(job());

    await user.click(screen.getByRole('button', { name: 'reports.history.download' }));

    const alert = await screen.findByRole('alert');
    expect(alert.getAttribute('aria-live')).toBe('assertive');
    expect(alert.textContent).toContain('error.notFound');
  });

  it('offers a manual retry for a failed job', async () => {
    const user = userEvent.setup();
    renderItem(job({ state: 'failed', completedAt: null, expiresAt: null }));

    await user.click(screen.getByRole('button', { name: 'reports.history.retry' }));

    expect(retryReport).toHaveBeenCalledWith({ data: { jobId: 7 } });
  });

  it('does not offer actions for pending or processing jobs', () => {
    renderItem(job({ state: 'pending', completedAt: null, expiresAt: null }));

    expect(screen.getByText('reports.history.state.pending')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'reports.history.download' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'reports.history.retry' })).toBeNull();
  });

  it('marks an expired job as unavailable without a download action', () => {
    renderItem(job({ state: 'expired', completedAt: null, expiresAt: null }));

    expect(screen.getByText('reports.history.state.expired')).toBeDefined();
    expect(screen.getByText('reports.history.expiredHint')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'reports.history.download' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'reports.history.retry' })).toBeNull();
  });
});
