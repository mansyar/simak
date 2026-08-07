/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
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
  afterEach(() => vi.restoreAllMocks());

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

    expect(screen.getByRole('heading', { name: 'adminAcademicContext.title' })).toBeDefined();
    expect(screen.getByText('2026-FALL')).toBeDefined();
    expect(screen.getByText('CS101')).toBeDefined();
    expect(screen.getByText('Section A')).toBeDefined();
    expect(screen.getByText('Ada Lovelace')).toBeDefined();
    expect(screen.getByText('adminAcademicContext.roles.student')).toBeDefined();
    expect(
      screen.getAllByRole('button', { name: 'adminAcademicContext.actions.archive' })[0],
    ).toBeDefined();
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
    expect(screen.getByRole('status')).toBeDefined();

    rerender(<AcademicContextPage {...props} loading={false} error={null} />);
    expect(screen.getByText('adminAcademicContext.empty')).toBeDefined();

    rerender(
      <AcademicContextPage
        {...props}
        loading={false}
        error={{ code: 'INTERNAL', message: 'database failure' }}
      />,
    );
    expect(screen.getByRole('alert')).toBeDefined();
    expect(screen.queryByText('database failure')).toBeNull();
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

    fireEvent.click(
      screen.getAllByRole('button', { name: 'adminAcademicContext.actions.archive' })[0],
    );
    expect(onArchive).not.toHaveBeenCalled();
  });

  it('supports editing terms and history-safe enrollment removal', () => {
    const onUpdateTerm = vi.fn();
    const onRemoveEnrollment = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <AcademicContextPage
        {...contextData}
        loading={false}
        error={null}
        onUpdateTerm={onUpdateTerm}
        onRemoveEnrollment={onRemoveEnrollment}
        onArchive={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getAllByRole('button', { name: 'adminAcademicContext.actions.edit' })[0],
    );
    fireEvent.click(screen.getByRole('button', { name: 'adminAcademicContext.forms.submit' }));
    expect(onUpdateTerm).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, code: '2026-FALL', status: 'active' }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'adminAcademicContext.removeEnrollment' }));
    expect(onRemoveEnrollment).toHaveBeenCalledWith({ sectionId: 3, userId: 'student-1' });
  });
});
