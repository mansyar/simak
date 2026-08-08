/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

const { api, mockFormatAppointmentRange } = vi.hoisted(() => ({
  api: {
    listInstructorAppointments: vi.fn(),
    createAppointmentSlot: vi.fn(),
    cancelAppointment: vi.fn(),
    rescheduleAppointment: vi.fn(),
    completeAppointment: vi.fn(),
    markAppointmentNoShow: vi.fn(),
  },
  mockFormatAppointmentRange: vi.fn(() => ({
    startLabel: 'Aug 9, 2026, 8:00 AM',
    endLabel: 'Aug 9, 2026, 9:00 AM',
    timeZone: 'America/New_York',
  })),
}));

vi.mock('@/server/appointments', () => api);
vi.mock('@/lib/appointment-policies', () => ({
  formatAppointmentRange: mockFormatAppointmentRange,
  validateAppointmentWindow: vi.fn(() => ({ valid: true })),
}));
vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    locale: 'en',
    t: (key: string, params?: Record<string, string>) => {
      const translations: Record<string, string> = {
        'instructorAppointments.title': 'Consultation scheduling',
        'instructorAppointments.publishTitle': 'Publish a slot',
        'instructorAppointments.startAt': 'Start time',
        'instructorAppointments.endAt': 'End time',
        'instructorAppointments.checkpoint': 'Checkpoint',
        'instructorAppointments.allCheckpoints': 'Assignment-wide',
        'instructorAppointments.publish': 'Publish slot',
        'instructorAppointments.available': 'Available',
        'instructorAppointments.booked': 'Booked',
        'instructorAppointments.cancelled': 'Cancelled',
        'instructorAppointments.completed': 'Completed',
        'instructorAppointments.noShow': 'No-show',
        'instructorAppointments.student': 'Student',
        'instructorAppointments.noStudent': 'No student yet',
        'instructorAppointments.cancel': 'Cancel appointment',
        'instructorAppointments.cancelConfirm': 'Cancel this appointment?',
        'instructorAppointments.reschedule': 'Reschedule appointment',
        'instructorAppointments.replacement': 'Replacement slot',
        'instructorAppointments.complete': 'Mark completed',
        'instructorAppointments.markNoShow': 'Mark no-show',
        'instructorAppointments.empty': 'No appointments found',
        'instructorAppointments.loading': 'Loading appointments',
        'instructorAppointments.error': 'Unable to load appointments',
        'instructorAppointments.retry': 'Retry',
        'instructorAppointments.conflict': 'This appointment conflicts with another booking.',
        'instructorAppointments.invalidWindow': 'Choose a valid future slot.',
        'instructorAppointments.timeZone': 'Time zone: {timeZone}',
      };
      let value = translations[key] ?? key;
      for (const [name, replacement] of Object.entries(params ?? {})) {
        value = value.replace(`{${name}}`, replacement);
      }
      return value;
    },
  }),
}));
vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    loading,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & {
    loading?: boolean;
    children?: ReactNode;
  }) => (
    <button {...props} disabled={Boolean(loading) || props.disabled}>
      {children}
    </button>
  ),
}));

import { InstructorAppointmentPanel } from '@/components/instructor/assignments/InstructorAppointmentPanel';

const available = {
  id: 101,
  assignmentId: 10,
  checkpointId: 7,
  checkpointName: 'Proposal',
  instructorId: 'instructor-1',
  studentId: null,
  studentName: null,
  studentEmail: null,
  startAt: new Date('2026-08-09T12:00:00.000Z'),
  endAt: new Date('2026-08-09T13:00:00.000Z'),
  status: 'available' as const,
  createdAt: new Date('2026-08-01T00:00:00.000Z'),
  updatedAt: new Date('2026-08-01T00:00:00.000Z'),
};

const booked = {
  ...available,
  id: 201,
  studentId: 'student-1',
  studentName: 'Alice',
  studentEmail: 'alice@example.com',
  status: 'booked' as const,
};

const replacement = {
  ...available,
  id: 202,
  checkpointId: null,
  startAt: new Date('2026-08-10T12:00:00.000Z'),
  endAt: new Date('2026-08-10T13:00:00.000Z'),
};

function renderPanel() {
  return render(
    <InstructorAppointmentPanel assignmentId={10} checkpoints={[{ id: 7, name: 'Proposal' }]} />,
  );
}

describe('InstructorAppointmentPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.listInstructorAppointments.mockResolvedValue({
      appointments: [available, booked, replacement],
      total: 3,
    });
    api.createAppointmentSlot.mockResolvedValue({ appointment: available });
    api.cancelAppointment.mockResolvedValue({ appointment: { ...booked, status: 'cancelled' } });
    api.rescheduleAppointment.mockResolvedValue({ appointment: booked });
    api.completeAppointment.mockResolvedValue({ appointment: { ...booked, status: 'completed' } });
    api.markAppointmentNoShow.mockResolvedValue({
      appointment: { ...booked, status: 'no_show' },
    });
  });

  it('renders slot controls, booked student details, statuses, and timezone labels', async () => {
    renderPanel();

    expect(await screen.findByRole('heading', { name: 'Consultation scheduling' })).toBeTruthy();
    expect(screen.getByText('Publish a slot')).toBeTruthy();
    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getAllByText('Available').length).toBeGreaterThan(0);
    expect(screen.getByText('Booked')).toBeTruthy();
    expect(screen.getAllByText(/Time zone: America\/New_York/).length).toBeGreaterThan(0);
  });

  it('publishes a valid assignment/checkpoint slot and refreshes', async () => {
    renderPanel();

    fireEvent.change(await screen.findByLabelText('Start time'), {
      target: { value: '2026-08-11T08:00' },
    });
    fireEvent.change(screen.getByLabelText('End time'), {
      target: { value: '2026-08-11T09:00' },
    });
    fireEvent.change(screen.getByLabelText('Checkpoint'), { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: 'Publish slot' }));

    await waitFor(() => expect(api.createAppointmentSlot).toHaveBeenCalledTimes(1));
    expect(api.createAppointmentSlot).toHaveBeenCalledWith({
      data: expect.objectContaining({ assignmentId: 10, checkpointId: 7 }),
    });
  });

  it('requires cancellation confirmation and supports replacement-slot rescheduling', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderPanel();

    fireEvent.click(await screen.findByRole('button', { name: 'Cancel appointment' }));
    expect(confirm).toHaveBeenCalled();
    expect(api.cancelAppointment).not.toHaveBeenCalled();

    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel appointment' }));
    await waitFor(() =>
      expect(api.cancelAppointment).toHaveBeenCalledWith({
        data: { appointmentId: 201 },
      }),
    );

    fireEvent.change(screen.getByLabelText('Replacement slot'), { target: { value: '202' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reschedule appointment' }));
    await waitFor(() =>
      expect(api.rescheduleAppointment).toHaveBeenCalledWith({
        data: { appointmentId: 201, replacementAppointmentId: 202 },
      }),
    );
    confirm.mockRestore();
  });

  it('offers completion and no-show actions for ended booked appointments', async () => {
    const endedBooked = {
      ...booked,
      startAt: new Date('2020-08-09T12:00:00.000Z'),
      endAt: new Date('2020-08-09T13:00:00.000Z'),
    };
    api.listInstructorAppointments.mockResolvedValue({
      appointments: [endedBooked],
      total: 1,
    });
    renderPanel();

    fireEvent.click(await screen.findByRole('button', { name: 'Mark completed' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mark no-show' }));
    await waitFor(() => {
      expect(api.completeAppointment).toHaveBeenCalledWith({ data: { appointmentId: 201 } });
      expect(api.markAppointmentNoShow).toHaveBeenCalledWith({ data: { appointmentId: 201 } });
    });
  });

  it('shows generic authorization/error feedback and empty states without mutation access', async () => {
    api.listInstructorAppointments.mockResolvedValue({
      error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
    });
    renderPanel();

    expect(await screen.findByRole('status')).toHaveTextContent('Unable to load appointments');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
    expect(api.createAppointmentSlot).not.toHaveBeenCalled();

    api.listInstructorAppointments.mockResolvedValue({ appointments: [], total: 0 });
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('No appointments found')).toBeTruthy();
  });
});
