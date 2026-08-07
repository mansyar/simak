/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AssignmentContextControls } from '@/components/instructor/assignments/AssignmentContextControls';

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

const sections = [
  {
    id: 10,
    label: 'CS101 · 2026-FALL · A',
    termId: 1,
    courseId: 2,
    status: 'active' as const,
  },
];

const students = [{ id: 'student-1', name: 'Ada Lovelace', email: 'ada@example.com' }];

describe('AssignmentContextControls', () => {
  it('renders section, authorized-student, mode, and lifecycle controls', () => {
    render(
      <AssignmentContextControls
        sections={sections}
        students={students}
        selectedSectionId={10}
        selectedStudentIds={['student-1']}
        mode="individual"
        status="draft"
        onSectionChange={vi.fn()}
        onStudentChange={vi.fn()}
        onModeChange={vi.fn()}
        onStatusChange={vi.fn()}
        onClone={vi.fn()}
        onRollover={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('instructorAssignments.context.section')).toBeDefined();
    expect(screen.getByLabelText('instructorAssignments.context.students')).toBeDefined();
    expect(screen.getByLabelText('instructorAssignments.context.mode')).toBeDefined();
    expect(screen.getByLabelText('instructorAssignments.context.status')).toBeDefined();
    expect(
      screen.getByRole('button', { name: 'instructorAssignments.actions.clone' }),
    ).toBeDefined();
    expect(
      screen.getByRole('button', { name: 'instructorAssignments.actions.rollover' }),
    ).toBeDefined();
  });

  it('emits context, lifecycle, and clone actions', () => {
    const onSectionChange = vi.fn();
    const onStatusChange = vi.fn();
    const onClone = vi.fn();
    const onRollover = vi.fn();

    render(
      <AssignmentContextControls
        sections={sections}
        students={students}
        selectedSectionId={10}
        selectedStudentIds={[]}
        mode="individual"
        status="draft"
        onSectionChange={onSectionChange}
        onStudentChange={vi.fn()}
        onModeChange={vi.fn()}
        onStatusChange={onStatusChange}
        onClone={onClone}
        onRollover={onRollover}
      />,
    );

    fireEvent.change(screen.getByLabelText('instructorAssignments.context.section'), {
      target: { value: '10' },
    });
    fireEvent.change(screen.getByLabelText('instructorAssignments.context.status'), {
      target: { value: 'active' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'instructorAssignments.actions.clone' }));
    fireEvent.click(screen.getByRole('button', { name: 'instructorAssignments.actions.rollover' }));

    expect(onSectionChange).toHaveBeenCalledWith(10);
    expect(onStatusChange).toHaveBeenCalledWith('active');
    expect(onClone).toHaveBeenCalledOnce();
    expect(onRollover).toHaveBeenCalledOnce();
  });
});
