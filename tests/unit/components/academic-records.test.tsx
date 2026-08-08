import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AcademicRecordsView } from '@/components/academic-records/AcademicRecordsView';

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

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
  sourceReleaseVersion: 1,
  policyVersion: 2,
  recordVersion: 1,
  numericScore: 91.25,
  letterGrade: 'A',
  status: 'complete' as const,
  credits: 3,
  gradePoints: 4,
  publishedAt: '2026-02-01T10:00:00.000Z',
};

const data = {
  page: 1,
  limit: 20,
  total: 3,
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
  it('renders GPA summaries and complete, incomplete, and withdrawn records', () => {
    render(<AcademicRecordsView data={data} role="student" />);

    expect(screen.getByText('academicRecords.termGpa')).toBeDefined();
    expect(screen.getByText('academicRecords.cumulativeGpa')).toBeDefined();
    expect(screen.getAllByText('4.00')).toHaveLength(2);
    expect(screen.getByText('CS101')).toBeDefined();
    expect(screen.getByText('CS102')).toBeDefined();
    expect(screen.getByText('CS103')).toBeDefined();
    expect(screen.getByText('academicRecords.status.complete')).toBeDefined();
    expect(screen.getByText('academicRecords.status.incomplete')).toBeDefined();
    expect(screen.getByText('academicRecords.status.withdrawn')).toBeDefined();
    expect(screen.getAllByText('academicRecords.gpaExcluded')).toHaveLength(2);
  });

  it('shows policy and source metadata for administrators only', () => {
    const { rerender } = render(<AcademicRecordsView data={data} role="student" />);
    expect(screen.queryByText('academicRecords.policyVersion')).toBeNull();

    rerender(<AcademicRecordsView data={data} role="admin" />);
    expect(screen.getByText('academicRecords.policyVersion')).toBeDefined();
    expect(screen.getByText('academicRecords.sourceRelease')).toBeDefined();
    expect(screen.getByText('academicRecords.sourceAssignment')).toBeDefined();
  });

  it('emits a term change from the accessible filter', () => {
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

    fireEvent.change(screen.getByLabelText('academicRecords.termFilter'), {
      target: { value: '2' },
    });

    expect(onTermChange).toHaveBeenCalledWith(2);
  });

  it('renders empty and unavailable states without pretending there is an official GPA', () => {
    const { rerender } = render(
      <AcademicRecordsView
        data={{
          page: 1,
          limit: 20,
          total: 0,
          records: [],
          termGpa: null,
          cumulativeGpa: null,
        }}
        role="student"
      />,
    );
    expect(screen.getByText('academicRecords.empty')).toBeDefined();
    expect(screen.getByText('academicRecords.gpaUnavailable')).toBeDefined();

    rerender(
      <AcademicRecordsView
        data={{ error: { code: 'FORBIDDEN', message: 'Forbidden' } }}
        role="instructor"
      />,
    );
    expect(screen.getByText('errors.forbidden')).toBeDefined();
  });
});
