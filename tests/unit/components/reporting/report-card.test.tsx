import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({ t: (key: string) => key, locale: 'en', setLocale: vi.fn() }),
}));

vi.mock('@/server/reporting', () => ({
  requestReport: vi.fn(),
}));

vi.mock('@/server/users', () => ({
  listUsers: vi.fn(),
}));

import { ReportCard } from '@/components/reporting/ReportCard';
import { requestReport } from '@/server/reporting';
import { listUsers } from '@/server/users';
import type { CatalogFilterOptions } from '@/lib/reporting-options';
import type { ReportType, ReportingRole } from '@/lib/reporting-policy';

const options: CatalogFilterOptions = {
  terms: [
    { id: 1, code: '2026-FALL', name: 'Fall 2026' },
    { id: 2, code: '2026-SPRING', name: 'Spring 2026' },
  ],
  courses: [
    { id: 10, code: 'IF101', name: 'Algorithms' },
    { id: 20, code: 'IF201', name: 'Databases' },
  ],
  sections: [
    { id: 100, code: 'A', name: 'Morning', cohort: '2026', termId: 1, courseId: 10 },
    { id: 101, code: 'B', name: 'Evening', cohort: '2026', termId: 1, courseId: 10 },
    { id: 102, code: 'C', name: 'Weekend', cohort: '2027', termId: 1, courseId: 20 },
    { id: 103, code: 'A', name: 'Morning', cohort: '2027', termId: 2, courseId: 10 },
  ],
  cohorts: ['2026', '2027'],
};

const defaultJob = {
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

function renderCard(reportType: ReportType, role: ReportingRole = 'admin') {
  return renderWithQuery(<ReportCard reportType={reportType} role={role} options={options} />);
}

async function chooseOption(comboboxLabel: string, optionText: string) {
  const user = userEvent.setup();
  await user.click(screen.getByRole('combobox', { name: comboboxLabel }));
  const option = screen
    .getAllByRole('option')
    .find((element) => element.textContent === optionText);
  expect(option).toBeDefined();
  await user.click(option!);
}

describe('ReportCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listUsers).mockResolvedValue({ users: [], total: 0 });
    vi.mocked(requestReport).mockResolvedValue({ job: { ...defaultJob, state: 'completed' } });
  });

  it('submits normalized filters and the selected student for admin transcripts', async () => {
    const user = userEvent.setup();
    vi.mocked(listUsers).mockResolvedValue({ users: [alice], total: 1 });
    renderCard('official_transcript', 'admin');

    await user.click(screen.getByLabelText('reports.student.searchLabel'));
    await user.click(await screen.findByRole('option', { name: /Alice/ }));
    await chooseOption('reports.filters.term', 'Fall 2026');
    await chooseOption('reports.filters.course', 'IF101 - Algorithms');
    await chooseOption('reports.filters.section', 'IF101 - A - Morning');
    await chooseOption('reports.filters.cohort', '2026');

    await user.click(screen.getByRole('button', { name: 'reports.generate' }));

    await waitFor(() => {
      expect(requestReport).toHaveBeenCalledWith({
        data: {
          reportType: 'official_transcript',
          locale: 'en',
          filters: { termId: 1, courseId: 10, sectionId: 100, cohort: '2026' },
          studentId: 'student-1',
        },
      });
    });
  });

  it('blocks generation without a selected student and announces the validation error', async () => {
    const user = userEvent.setup();
    vi.mocked(listUsers).mockResolvedValue({ users: [alice], total: 1 });
    renderCard('official_transcript', 'admin');

    await user.click(screen.getByRole('button', { name: 'reports.generate' }));

    expect(await screen.findByText('reports.validation.studentRequired')).toBeDefined();
    expect(screen.getByRole('alert')).toBeDefined();
    expect(requestReport).not.toHaveBeenCalled();
  });

  it('renders authorized filters but no subject control for student self-transcripts', async () => {
    const user = userEvent.setup();
    renderCard('official_transcript', 'student');

    expect(await screen.findByRole('combobox', { name: 'reports.filters.term' })).toBeDefined();
    expect(screen.getByRole('combobox', { name: 'reports.filters.course' })).toBeDefined();
    expect(screen.getByRole('combobox', { name: 'reports.filters.section' })).toBeDefined();
    expect(screen.getByRole('combobox', { name: 'reports.filters.cohort' })).toBeDefined();
    expect(screen.queryByText('reports.student.label')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'reports.generate' }));

    await waitFor(() => {
      expect(requestReport).toHaveBeenCalledWith({
        data: {
          reportType: 'official_transcript',
          locale: 'en',
          filters: { termId: null, courseId: null, sectionId: null, cohort: null },
        },
      });
    });
    expect(vi.mocked(requestReport).mock.calls[0][0].data).not.toHaveProperty('studentId');
  });

  it('submits an own-subject transcript request with student-selected filters', async () => {
    const user = userEvent.setup();
    renderCard('official_transcript', 'student');

    await screen.findByRole('combobox', { name: 'reports.filters.term' });
    await chooseOption('reports.filters.term', 'Spring 2026');
    await chooseOption('reports.filters.course', 'IF101 - Algorithms');
    await user.click(screen.getByRole('button', { name: 'reports.generate' }));

    await waitFor(() => {
      expect(requestReport).toHaveBeenCalledWith({
        data: {
          reportType: 'official_transcript',
          locale: 'en',
          filters: { termId: 2, courseId: 10, sectionId: null, cohort: null },
        },
      });
    });
    expect(vi.mocked(requestReport).mock.calls[0][0].data).not.toHaveProperty('studentId');
  });

  it('shows dependent filters for instructor analytics without a student subject control', async () => {
    renderCard('analytics_summary', 'instructor');

    expect(await screen.findByRole('combobox', { name: 'reports.filters.term' })).toBeDefined();
    expect(screen.queryByText('reports.student.label')).toBeNull();
  });

  it('narrows course, section, and cohort options from upstream selections', async () => {
    const user = userEvent.setup();
    renderCard('institutional_academic_summary', 'admin');

    await chooseOption('reports.filters.term', 'Spring 2026');

    await user.click(screen.getByRole('combobox', { name: 'reports.filters.course' }));
    const courseOptions = screen.getAllByRole('option').map((element) => element.textContent);
    expect(courseOptions).toContain('IF101 - Algorithms');
    expect(courseOptions).not.toContain('IF201 - Databases');
    await user.click(screen.getByRole('option', { name: 'IF101 - Algorithms' }));

    await user.click(screen.getByRole('combobox', { name: 'reports.filters.section' }));
    const sectionOptions = screen.getAllByRole('option').map((element) => element.textContent);
    expect(sectionOptions).toContain('IF101 - A - Morning');
    expect(sectionOptions).not.toContain('IF101 - B - Evening');
    await user.click(screen.getByRole('option', { name: 'IF101 - A - Morning' }));

    await user.click(screen.getByRole('combobox', { name: 'reports.filters.cohort' }));
    const cohortOptions = screen.getAllByRole('option').map((element) => element.textContent);
    expect(cohortOptions).toContain('2027');
    expect(cohortOptions).not.toContain('2026');
  });

  it('clears downstream selections when an upstream filter changes', async () => {
    const user = userEvent.setup();
    renderCard('institutional_academic_summary', 'admin');

    await chooseOption('reports.filters.term', 'Fall 2026');
    await chooseOption('reports.filters.course', 'IF201 - Databases');
    await chooseOption('reports.filters.term', 'Spring 2026');

    await user.click(screen.getByRole('button', { name: 'reports.generate' }));

    await waitFor(() => {
      expect(requestReport).toHaveBeenCalledWith({
        data: {
          reportType: 'institutional_academic_summary',
          locale: 'en',
          filters: { termId: 2, courseId: null, sectionId: null, cohort: null },
        },
      });
    });
  });

  it('sends the selected report language with the request', async () => {
    const user = userEvent.setup();
    renderCard('analytics_summary', 'admin');

    await user.click(screen.getByRole('button', { name: 'reports.locale.indonesian' }));
    await user.click(screen.getByRole('button', { name: 'reports.generate' }));

    await waitFor(() => {
      expect(requestReport).toHaveBeenCalledWith({
        data: {
          reportType: 'analytics_summary',
          locale: 'id',
          filters: { termId: null, courseId: null, sectionId: null, cohort: null },
        },
      });
    });
  });

  it('defaults to English and marks the active language button', () => {
    renderCard('analytics_summary', 'admin');

    expect(screen.getByRole('button', { name: 'reports.locale.english' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'reports.locale.indonesian' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('shows a generating state and disables the submit button while pending', async () => {
    const user = userEvent.setup();
    let resolveRequest: (value: Awaited<ReturnType<typeof requestReport>>) => void = () => {};
    vi.mocked(requestReport).mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );
    renderCard('analytics_summary', 'admin');

    await user.click(screen.getByRole('button', { name: 'reports.generate' }));

    const generatingButton = screen.getByRole('button', { name: 'reports.generating' });
    expect(generatingButton).toHaveProperty('disabled', true);
    expect(screen.getByText('reports.generating')).toBeDefined();

    resolveRequest({ job: { ...defaultJob, state: 'completed' } });
    expect(await screen.findByText('reports.job.completed')).toBeDefined();
  });

  it('announces a completed job state', async () => {
    const user = userEvent.setup();
    vi.mocked(requestReport).mockResolvedValue({ job: { ...defaultJob, state: 'completed' } });
    renderCard('analytics_summary', 'admin');

    await user.click(screen.getByRole('button', { name: 'reports.generate' }));

    expect(await screen.findByText('reports.job.completed')).toBeDefined();
  });

  it('announces a failed job state returned by the server', async () => {
    const user = userEvent.setup();
    vi.mocked(requestReport).mockResolvedValue({ job: { ...defaultJob, state: 'failed' } });
    renderCard('analytics_summary', 'admin');

    await user.click(screen.getByRole('button', { name: 'reports.generate' }));

    expect(await screen.findByText('reports.job.failed')).toBeDefined();
  });

  it('announces a server error when report generation fails', async () => {
    const user = userEvent.setup();
    vi.mocked(requestReport).mockResolvedValue({ error: { code: 'INTERNAL', message: 'boom' } });
    renderCard('analytics_summary', 'admin');

    await user.click(screen.getByRole('button', { name: 'reports.generate' }));

    expect(await screen.findByRole('alert')).toBeDefined();
    expect(screen.getByText('error.internal')).toBeDefined();
  });
});
