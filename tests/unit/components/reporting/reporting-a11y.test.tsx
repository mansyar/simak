import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({ t: (key: string) => key, locale: 'en', setLocale: vi.fn() }),
}));

vi.mock('@/server/reporting', () => ({
  downloadReport: vi.fn(),
  getReportCatalog: vi.fn(),
  getReportHistory: vi.fn(),
  requestReport: vi.fn(),
  retryReport: vi.fn(),
}));

vi.mock('@/server/users', () => ({
  listUsers: vi.fn(),
}));

import { ReportCatalogControls } from '@/components/reporting/ReportCatalogControls';
import { getReportCatalog, getReportHistory, requestReport } from '@/server/reporting';
import { listUsers } from '@/server/users';

const filters = {
  terms: [{ id: 1, code: '2026-FALL', name: 'Fall 2026' }],
  courses: [{ id: 10, code: 'IF101', name: 'Algorithms' }],
  sections: [{ id: 100, code: 'A', name: 'Morning', cohort: '2026', termId: 1, courseId: 10 }],
  cohorts: ['2026'],
};

const job = {
  id: 1,
  reportType: 'analytics_summary' as const,
  locale: 'en' as const,
  createdAt: new Date(),
  expiresAt: new Date(),
};

const alice = {
  id: 'student-1',
  name: 'Alice',
  email: 'alice@example.com',
  role: 'student' as const,
  locale: null,
  emailVerified: false,
  createdAt: new Date(),
  deletedAt: null,
};

function renderWithQuery(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('reporting accessibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getReportCatalog).mockResolvedValue({
      reports: ['institutional_academic_summary', 'official_transcript', 'analytics_summary'],
      filters,
    });
    vi.mocked(getReportHistory).mockResolvedValue({ jobs: [] });
    vi.mocked(listUsers).mockResolvedValue({
      users: [alice],
      total: 1,
    });
    vi.mocked(requestReport).mockResolvedValue({ job: { ...job, state: 'completed' } });
  });

  it('meets touch target and visible focus conventions for every control', async () => {
    const { container } = renderWithQuery(<ReportCatalogControls role="admin" />);
    await screen.findByText('reports.types.institutional_academic_summary.name');

    for (const element of container.querySelectorAll('button, input')) {
      if (element.getAttribute('aria-hidden') === 'true') continue;
      expect(element.className).toContain('min-h-11');
      expect(element.className).toMatch(/focus-visible:(ring-2|ring-3)/);
      expect(element.className).toContain('ring-ring');
    }
  });

  it('labels every select control', async () => {
    renderWithQuery(<ReportCatalogControls role="admin" />);
    await screen.findByText('reports.types.institutional_academic_summary.name');

    const comboboxes = screen.getAllByRole('combobox');
    expect(comboboxes.length).toBeGreaterThan(0);
    for (const combobox of comboboxes) {
      expect(
        combobox.getAttribute('aria-label') ||
          combobox.getAttribute('aria-labelledby') ||
          document.querySelector(`label[for="${combobox.id}"]`),
      ).toBeTruthy();
    }
  });

  it('labels the student search field', async () => {
    renderWithQuery(<ReportCatalogControls role="admin" />);
    await screen.findByText('reports.types.institutional_academic_summary.name');

    expect(screen.getByLabelText('reports.student.searchLabel')).toBeDefined();
  });

  it('scopes each report card as a labeled region', async () => {
    renderWithQuery(<ReportCatalogControls role="admin" />);
    await screen.findByText('reports.types.institutional_academic_summary.name');

    expect(
      screen.getByRole('region', { name: 'reports.types.official_transcript.name' }),
    ).toBeDefined();
    expect(
      screen.getByRole('region', { name: 'reports.types.institutional_academic_summary.name' }),
    ).toBeDefined();
    expect(
      screen.getByRole('region', { name: 'reports.types.analytics_summary.name' }),
    ).toBeDefined();
  });

  it('announces validation errors via an assertive live region', async () => {
    const user = userEvent.setup();
    renderWithQuery(<ReportCatalogControls role="admin" />);
    await screen.findByText('reports.types.institutional_academic_summary.name');

    const transcriptCard = screen.getByRole('region', {
      name: 'reports.types.official_transcript.name',
    });
    await user.click(within(transcriptCard).getByRole('button', { name: 'reports.generate' }));

    const alert = await within(transcriptCard).findByRole('alert');
    expect(alert.getAttribute('aria-live')).toBe('assertive');
    expect(alert.textContent).toContain('reports.validation.studentRequired');
  });

  it('announces generation success via a polite live region', async () => {
    const user = userEvent.setup();
    renderWithQuery(<ReportCatalogControls role="admin" />);
    await screen.findByText('reports.types.institutional_academic_summary.name');

    const analyticsCard = screen.getByRole('region', {
      name: 'reports.types.analytics_summary.name',
    });
    await user.click(within(analyticsCard).getByRole('button', { name: 'reports.generate' }));

    const status = await within(analyticsCard).findByRole('status');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.textContent).toContain('reports.job.completed');
  });

  it('marks the generating card as busy', async () => {
    const user = userEvent.setup();
    vi.mocked(requestReport).mockReturnValue(new Promise(() => {}));
    renderWithQuery(<ReportCatalogControls role="admin" />);
    await screen.findByText('reports.types.institutional_academic_summary.name');

    const analyticsCard = screen.getByRole('region', {
      name: 'reports.types.analytics_summary.name',
    });
    await user.click(within(analyticsCard).getByRole('button', { name: 'reports.generate' }));

    expect(analyticsCard).toHaveAttribute('aria-busy', 'true');
  });

  it('exposes student options with listbox semantics rather than buttons', async () => {
    const user = userEvent.setup();
    renderWithQuery(<ReportCatalogControls role="admin" />);
    await screen.findByText('reports.types.institutional_academic_summary.name');

    await user.click(screen.getByLabelText('reports.student.searchLabel'));

    const search = screen.getByRole('combobox', { name: 'reports.student.searchLabel' });
    expect(search).toHaveAttribute('aria-expanded', 'true');
    expect(search).toHaveAttribute('aria-controls');
    const listbox = await screen.findByRole('listbox');
    expect(within(listbox).queryAllByRole('button')).toHaveLength(0);
    const option = await within(listbox).findByRole('option', { name: /Alice/ });
    expect(option).toHaveAttribute('aria-selected', 'false');
  });

  it('supports keyboard selection in the transcript picker', async () => {
    const user = userEvent.setup();
    renderWithQuery(<ReportCatalogControls role="admin" />);
    await screen.findByText('reports.types.institutional_academic_summary.name');

    const search = screen.getByRole('combobox', { name: 'reports.student.searchLabel' });
    await user.click(search);
    const options = await screen.findAllByRole('option');

    await user.keyboard('{ArrowDown}');
    expect(document.getElementById(search.getAttribute('aria-activedescendant')!)).toBe(options[0]);

    await user.keyboard('{Enter}');

    const transcriptCard = screen.getByRole('region', {
      name: 'reports.types.official_transcript.name',
    });
    await user.click(within(transcriptCard).getByRole('button', { name: 'reports.generate' }));

    await waitFor(() => {
      expect(requestReport).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ studentId: 'student-1' }),
        }),
      );
    });
  });

  it('keeps filter label ids unique across multiple report cards', async () => {
    renderWithQuery(<ReportCatalogControls role="admin" />);
    await screen.findByText('reports.types.institutional_academic_summary.name');

    const ids = Array.from(document.querySelectorAll<HTMLElement>('[id$="-label"]')).map(
      (element) => element.id,
    );
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('scopes the history list as a labeled list with live status feedback', async () => {
    vi.mocked(getReportHistory).mockResolvedValue({
      jobs: [
        {
          id: 3,
          reportType: 'analytics_summary',
          locale: 'en',
          state: 'completed',
          createdAt: new Date('2026-08-10T10:00:00Z'),
          completedAt: new Date('2026-08-10T10:05:00Z'),
          failedAt: null,
          expiresAt: new Date('2026-09-09T10:00:00Z'),
        },
      ],
    });
    renderWithQuery(<ReportCatalogControls role="admin" />);
    await screen.findByText('reports.types.institutional_academic_summary.name');

    const list = await screen.findByRole('list', { name: 'reports.history.listLabel' });
    expect(within(list).getByRole('button', { name: 'reports.history.download' })).toBeDefined();
    expect(await screen.findByRole('status')).toBeDefined();
  });
});
