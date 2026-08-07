/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AcademicContextPage } from '@/components/admin/academic-context/AcademicContextPage';

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    locale: 'en',
  }),
}));

const contextData = {
  terms: [
    {
      id: 1,
      code: '2026-FALL',
      name: 'Fall 2026',
      startsOn: '2026-08-01',
      endsOn: '2026-12-20',
      status: 'active' as const,
    },
  ],
  courses: [{ id: 2, code: 'CS101', name: 'Foundations of Computing', status: 'active' as const }],
  sections: [
    {
      id: 3,
      code: 'A',
      name: 'Section A',
      termId: 1,
      courseId: 2,
      status: 'active' as const,
    },
  ],
  enrollments: [
    {
      id: 4,
      sectionId: 3,
      userId: 'student-1',
      userName: 'Ada Lovelace',
      role: 'student' as const,
      isActive: true,
    },
  ],
};

describe('AcademicContextPage', () => {
  it('renders all context collections and admin actions', () => {
    render(
      <AcademicContextPage
        {...contextData}
        loading={false}
        error={null}
        onCreateTerm={vi.fn()}
        onCreateCourse={vi.fn()}
        onCreateSection={vi.fn()}
        onAddEnrollment={vi.fn()}
        onArchive={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'adminAcademicContext.title' })).toBeInTheDocument();
    expect(screen.getByText('2026-FALL')).toBeInTheDocument();
    expect(screen.getByText('CS101')).toBeInTheDocument();
    expect(screen.getByText('Section A')).toBeInTheDocument();
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'adminAcademicContext.actions.archive' }),
    ).toBeInTheDocument();
  });

  it('renders loading, empty, and server-error states', () => {
    const props = {
      ...contextData,
      terms: [],
      courses: [],
      sections: [],
      enrollments: [],
      onCreateTerm: vi.fn(),
      onCreateCourse: vi.fn(),
      onCreateSection: vi.fn(),
      onAddEnrollment: vi.fn(),
      onArchive: vi.fn(),
    };

    const { rerender } = render(<AcademicContextPage {...props} loading error={null} />);
    expect(screen.getByRole('status')).toBeInTheDocument();

    rerender(<AcademicContextPage {...props} loading={false} error={null} />);
    expect(screen.getByText('adminAcademicContext.empty')).toBeInTheDocument();

    rerender(
      <AcademicContextPage
        {...props}
        loading={false}
        error={{ code: 'INTERNAL', message: 'database failure' }}
      />,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('database failure')).not.toBeInTheDocument();
  });

  it('requires confirmation before archiving context', () => {
    const onArchive = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(
      <AcademicContextPage
        {...contextData}
        loading={false}
        error={null}
        onCreateTerm={vi.fn()}
        onCreateCourse={vi.fn()}
        onCreateSection={vi.fn()}
        onAddEnrollment={vi.fn()}
        onArchive={onArchive}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'adminAcademicContext.actions.archive' }));
    expect(onArchive).not.toHaveBeenCalled();
  });
});
