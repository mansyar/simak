/** @vitest-environment happy-dom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { InterventionFilters } from '@/components/instructor/interventions/InterventionFilters';
import { InterventionForm } from '@/components/instructor/interventions/InterventionForm';
import { InterventionList } from '@/components/instructor/interventions/InterventionList';

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

const item = {
  id: 7,
  assignmentId: 3,
  studentId: 'student-1',
  actionType: 'consultation' as const,
  privateNote: 'Offer a consultation slot',
  status: 'open' as const,
  followUpDate: new Date('2026-08-01T00:00:00.000Z'),
  resolutionReason: null,
  createdAt: new Date('2026-07-25T00:00:00.000Z'),
  updatedAt: new Date('2026-07-25T00:00:00.000Z'),
  assignmentTitle: 'Research Methods',
  studentName: 'Ayu Pratama',
};

describe('InterventionList', () => {
  it('renders private intervention details, status, and overdue follow-up state', () => {
    render(
      <InterventionList
        interventions={[item]}
        now={new Date('2026-08-03T00:00:00.000Z')}
        onManage={vi.fn()}
      />,
    );

    expect(screen.getByText('Ayu Pratama')).toBeTruthy();
    expect(screen.getByText('Research Methods')).toBeTruthy();
    expect(screen.getByText('instructorInterventions.status.open')).toBeTruthy();
    expect(screen.getByText('instructorInterventions.overdue')).toBeTruthy();
    expect(screen.getByText(/Offer a consultation slot/)).toBeTruthy();
  });

  it('calls onManage for the selected intervention', () => {
    const onManage = vi.fn();
    render(<InterventionList interventions={[item]} onManage={onManage} />);

    fireEvent.click(screen.getByRole('button', { name: 'instructorInterventions.manage' }));
    expect(onManage).toHaveBeenCalledWith(item);
  });
});

describe('InterventionFilters', () => {
  it('emits status and overdue filter changes', async () => {
    const onStatusChange = vi.fn();
    const onOverdueChange = vi.fn();
    const user = userEvent.setup();
    render(
      <InterventionFilters
        status={null}
        overdue={false}
        onStatusChange={onStatusChange}
        onOverdueChange={onOverdueChange}
      />,
    );

    await user.click(
      screen.getByRole('combobox', { name: 'instructorInterventions.filters.status' }),
    );
    await user.click(
      screen.getByRole('option', { name: 'instructorInterventions.status.monitoring' }),
    );
    await user.click(
      screen.getByRole('checkbox', { name: 'instructorInterventions.filters.overdue' }),
    );

    expect(onStatusChange).toHaveBeenCalledWith('monitoring');
    expect(onOverdueChange).toHaveBeenCalledWith(true);
  });
});

describe('InterventionForm', () => {
  it('renders creation fields and submits the validated action type and note', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <InterventionForm mode="create" assignmentId={3} studentId="student-1" onSubmit={onSubmit} />,
    );

    expect(screen.getByLabelText('instructorInterventions.fields.actionType')).toBeTruthy();
    expect(screen.getByLabelText('instructorInterventions.fields.privateNote')).toBeTruthy();
    expect(screen.getByLabelText('instructorInterventions.fields.followUpDate')).toBeTruthy();

    await user.click(
      screen.getByRole('combobox', { name: 'instructorInterventions.fields.actionType' }),
    );
    await user.click(
      screen.getByRole('option', { name: 'instructorInterventions.actions.extension' }),
    );
    fireEvent.change(screen.getByLabelText('instructorInterventions.fields.privateNote'), {
      target: { value: 'Discuss an extension' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'instructorInterventions.create' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        assignmentId: 3,
        studentId: 'student-1',
        actionType: 'extension',
        privateNote: 'Discuss an extension',
      }),
    );
  });

  it('shows a closure reason field only when resolving or dismissing', async () => {
    const user = userEvent.setup();
    render(
      <InterventionForm
        mode="edit"
        intervention={item}
        assignmentId={3}
        studentId="student-1"
        onSubmit={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole('textbox', { name: 'instructorInterventions.fields.resolutionReason' }),
    ).toBeNull();
    await user.click(
      screen.getByRole('combobox', { name: 'instructorInterventions.fields.status' }),
    );
    await user.click(
      screen.getByRole('option', { name: 'instructorInterventions.status.resolved' }),
    );
    expect(
      screen.getByRole('textbox', { name: 'instructorInterventions.fields.resolutionReason' }),
    ).toBeTruthy();
  });

  it('submits a non-terminal status update without an empty closure reason', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <InterventionForm
        mode="edit"
        intervention={item}
        assignmentId={3}
        studentId="student-1"
        onSubmit={onSubmit}
      />,
    );

    await user.click(
      screen.getByRole('combobox', { name: 'instructorInterventions.fields.status' }),
    );
    await user.click(
      screen.getByRole('option', { name: 'instructorInterventions.status.monitoring' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'instructorInterventions.edit' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        interventionId: item.id,
        status: 'monitoring',
        resolutionReason: null,
      }),
    );
  });

  it('allows editing an intervention that has no follow-up date', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <InterventionForm
        mode="edit"
        intervention={{ ...item, followUpDate: null }}
        assignmentId={3}
        studentId="student-1"
        onSubmit={onSubmit}
      />,
    );

    await user.click(
      screen.getByRole('combobox', { name: 'instructorInterventions.fields.status' }),
    );
    await user.click(
      screen.getByRole('option', { name: 'instructorInterventions.status.monitoring' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'instructorInterventions.edit' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
  });

  it('resets the edit identifier when a loaded intervention replaces the create form', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    const { rerender } = render(
      <InterventionForm mode="create" assignmentId={3} studentId="student-1" onSubmit={onSubmit} />,
    );

    rerender(
      <InterventionForm
        mode="edit"
        intervention={item}
        assignmentId={3}
        studentId="student-1"
        onSubmit={onSubmit}
      />,
    );
    await user.click(
      screen.getByRole('combobox', { name: 'instructorInterventions.fields.status' }),
    );
    await user.click(
      screen.getByRole('option', { name: 'instructorInterventions.status.monitoring' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'instructorInterventions.edit' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ interventionId: item.id, status: 'monitoring' }),
    );
  });
});
