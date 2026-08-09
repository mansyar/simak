import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AcademicRecordsView } from '@/components/academic-records/AcademicRecordsView';

const i18nState = vi.hoisted(() => ({ locale: 'en' as 'en' | 'id' }));

vi.mock('@/routes/__root', async () => {
  const en = (await import('../../../locales/en.json')).default;
  const id = (await import('../../../locales/id.json')).default;
  const translations = { en, id } as Record<string, Record<string, unknown>>;

  return {
    useI18n: () => ({
      locale: i18nState.locale,
      t: (key: string, params?: Record<string, string>) => {
        const value = key
          .split('.')
          .reduce<unknown>(
            (current, part) =>
              typeof current === 'object' && current !== null
                ? (current as Record<string, unknown>)[part]
                : undefined,
            translations[i18nState.locale],
          );
        const text = typeof value === 'string' ? value : key;
        return text.replace(/\{(\w+)\}/g, (_, name) => params?.[name] ?? `{${name}}`);
      },
    }),
  };
});

const completeRecord = {
  recordId: 11,
  studentId: 'student-1',
  studentName: 'Student One',
  courseId: 9,
  courseCode: 'CS101',
  courseName: 'Algorithms',
  courseSectionId: 7,
  sectionCode: 'A',
  termId: 3,
  termCode: '2026-1',
  termName: 'Spring 2026',
  termStartDate: '2026-01-01',
  sourceAssignmentId: 42,
  sourceSnapshotId: 100,
  sourceReleaseVersion: 1,
  policyVersion: 2,
  recordVersion: 1,
  numericScore: 91.25,
  letterGrade: 'A',
  status: 'complete' as const,
  credits: 3,
  gradePoints: 4,
  roundingScale: 2,
  publishedAt: '2026-02-01T10:00:00.000Z',
  createdAt: '2026-02-01T10:00:00.000Z',
};

const data = {
  page: 1,
  limit: 20,
  total: 3,
  terms: [{ id: 3, code: '2026-1', name: 'Spring 2026' }],
  records: [
    completeRecord,
    {
      ...completeRecord,
      recordId: 12,
      courseId: 10,
      courseCode: 'CS102',
      courseName: 'Data Structures',
      status: 'incomplete' as const,
      letterGrade: null,
      numericScore: null,
      gradePoints: null,
    },
    {
      ...completeRecord,
      recordId: 13,
      courseId: 11,
      courseCode: 'CS103',
      courseName: 'Discrete Mathematics',
      status: 'withdrawn' as const,
      letterGrade: null,
      numericScore: null,
      gradePoints: null,
    },
  ],
  termGpa: { gpa: 4, totalCredits: 3, totalQualityPoints: 12, eligibleRecordIds: [11] },
  cumulativeGpa: { gpa: 4, totalCredits: 3, totalQualityPoints: 12, eligibleRecordIds: [11] },
};

describe('AcademicRecordsView', () => {
  beforeEach(() => {
    i18nState.locale = 'en';
  });

  it('renders GPA summaries and complete, incomplete, and withdrawn records', () => {
    render(<AcademicRecordsView data={data} role="student" />);

    expect(screen.getByText('Term GPA')).toBeDefined();
    expect(screen.getByText('Cumulative GPA')).toBeDefined();
    expect(screen.getAllByText('4.00')).toHaveLength(3);
    expect(screen.getByText('CS101')).toBeDefined();
    expect(screen.getByText('CS102')).toBeDefined();
    expect(screen.getByText('CS103')).toBeDefined();
    expect(screen.getByText('Complete')).toBeDefined();
    expect(screen.getByText('Incomplete')).toBeDefined();
    expect(screen.getByText('Withdrawn')).toBeDefined();
    expect(
      screen.getAllByText('This outcome is shown on the transcript but excluded from GPA.'),
    ).toHaveLength(2);
  });

  it('shows student identity and publication time in staff views', () => {
    const { rerender } = render(<AcademicRecordsView data={data} role="instructor" />);

    expect(screen.getAllByText('Student One')).toHaveLength(3);
    expect(screen.getAllByText('Published')).toHaveLength(3);

    rerender(
      <AcademicRecordsView
        data={{ ...data, records: [{ ...completeRecord, studentName: undefined }] }}
        role="instructor"
      />,
    );
    expect(screen.getByText('student-1')).toBeDefined();
  });

  it('shows policy and source metadata for administrators only', () => {
    const { rerender } = render(<AcademicRecordsView data={data} role="student" />);
    expect(screen.queryByText('Policy version')).toBeNull();

    rerender(<AcademicRecordsView data={data} role="admin" />);
    expect(screen.getAllByText('Policy version')).toHaveLength(3);
    expect(screen.getAllByText('Source release')).toHaveLength(3);
    expect(screen.getAllByText('Source assignment')).toHaveLength(3);
  });

  it('emits a term change from the accessible Radix filter', async () => {
    const user = userEvent.setup();
    const onTermChange = vi.fn();
    render(
      <AcademicRecordsView
        data={data}
        role="student"
        terms={[
          { id: 3, label: 'Spring 2026' },
          { id: 2, label: 'Fall 2025' },
        ]}
        selectedTermId={3}
        onTermChange={onTermChange}
      />,
    );

    await user.click(screen.getByRole('combobox', { name: 'Academic term' }));
    await user.click(screen.getByRole('option', { name: 'Fall 2025' }));

    expect(onTermChange).toHaveBeenCalledWith(2);
  });

  it('distinguishes unavailable terms, no records, and filtered no-results states', () => {
    const { rerender } = render(
      <AcademicRecordsView
        data={{
          page: 1,
          limit: 20,
          total: 0,
          terms: [],
          records: [],
          termGpa: null,
          cumulativeGpa: null,
        }}
        role="student"
      />,
    );
    expect(screen.getByText('No academic terms available')).toBeDefined();
    expect(
      screen.getAllByText('GPA is unavailable until an eligible released result exists.'),
    ).toHaveLength(2);

    rerender(
      <AcademicRecordsView
        data={{
          page: 1,
          limit: 20,
          total: 0,
          terms: [],
          records: [],
          termGpa: null,
          cumulativeGpa: null,
        }}
        role="student"
        terms={[{ id: 3, label: 'Spring 2026' }]}
      />,
    );
    expect(screen.getByText('No academic records yet')).toBeDefined();

    rerender(
      <AcademicRecordsView
        data={{
          page: 1,
          limit: 20,
          total: 0,
          terms: [],
          records: [],
          termGpa: null,
          cumulativeGpa: null,
        }}
        role="student"
        terms={[{ id: 3, label: 'Spring 2026' }]}
        selectedTermId={3}
      />,
    );
    expect(screen.getByText('No records in this academic term')).toBeDefined();

    rerender(
      <AcademicRecordsView
        data={{ error: { code: 'FORBIDDEN', message: 'Forbidden' } }}
        role="instructor"
      />,
    );
    expect(screen.getByText('You do not have permission to access this page')).toBeDefined();
  });

  it('renders a retry action for server errors', () => {
    const onRetry = vi.fn();
    render(
      <AcademicRecordsView
        data={{ error: { code: 'INTERNAL', message: 'Failed' } }}
        role="admin"
        onRetry={onRetry}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('uses the larger focusable filter controls for staff section selection', async () => {
    const user = userEvent.setup();
    const onSectionChange = vi.fn();
    render(
      <AcademicRecordsView
        data={data}
        role="instructor"
        sections={[{ id: 7, label: 'CS101 - A' }]}
        selectedSectionId={7}
        onSectionChange={onSectionChange}
      />,
    );

    const sectionSelect = screen.getByRole('combobox', { name: 'Course section' });
    expect(sectionSelect.className).toContain('min-h-11');
    expect(sectionSelect.className).toContain('focus-visible:ring-2');
    await user.click(sectionSelect);
    await user.click(screen.getByRole('option', { name: 'CS101 - A' }));
    expect(onSectionChange).toHaveBeenCalledWith(7);
  });

  it('renders actual English and Indonesian translations', () => {
    const { rerender } = render(<AcademicRecordsView data={data} role="student" />);
    expect(screen.getByRole('heading', { name: 'Academic records' })).toBeDefined();
    expect(screen.getByText('Term GPA')).toBeDefined();

    i18nState.locale = 'id';
    rerender(<AcademicRecordsView data={data} role="student" />);
    expect(screen.getByRole('heading', { name: 'Rekam akademik' })).toBeDefined();
    expect(screen.getByText('IP semester')).toBeDefined();
    expect(screen.getByText('Selesai')).toBeDefined();
  });

  it('announces and focuses updated filter results without focusing on initial render', async () => {
    const { rerender } = render(
      <AcademicRecordsView data={data} role="student" terms={[{ id: 3, label: 'Spring 2026' }]} />,
    );
    const status = screen.getByRole('status');
    expect(document.activeElement).not.toBe(status);
    expect(status.textContent).toContain('Academic records updated: 3 records, page 1.');

    rerender(
      <AcademicRecordsView
        data={{ ...data, total: 0, records: [], termGpa: null }}
        role="student"
        terms={[{ id: 3, label: 'Spring 2026' }]}
        selectedTermId={3}
      />,
    );

    await waitFor(() => expect(document.activeElement).toBe(status));
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.textContent).toContain('Academic records updated: 0 records, page 1.');
  });
});
