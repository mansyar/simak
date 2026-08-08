import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { api, mockFormatAppointmentRange, mockUseStudentTimezone } = vi.hoisted(() => ({
  api: {
    listAvailableAppointments: vi.fn(),
    listStudentAppointments: vi.fn(),
    bookAppointment: vi.fn(),
    cancelAppointment: vi.fn(),
    rescheduleAppointment: vi.fn(),
  },
  mockFormatAppointmentRange: vi.fn(() => ({
    startLabel: 'Aug 9, 2026, 8:00 AM',
    endLabel: 'Aug 9, 2026, 9:00 AM',
    timeZone: 'America/New_York',
  })),
  mockUseStudentTimezone: vi.fn(() => ({ timezone: 'America/New_York', hydrated: true })),
}));

vi.mock('@/server/appointments', () => api);
vi.mock('@/lib/appointment-policies', () => ({
  formatAppointmentRange: mockFormatAppointmentRange,
}));
vi.mock('@/hooks/use-student-timezone', () => ({ useStudentTimezone: mockUseStudentTimezone }));
vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    locale: 'en',
    t: (key: string, params?: Record<string, string>) => {
      const translations: Record<string, string> = {
        'studentAppointments.title': 'Appointments',
        'studentAppointments.availableSlots': 'Available slots',
        'studentAppointments.yourAppointments': 'Your appointments',
        'studentAppointments.book': 'Book',
        'studentAppointments.reschedule': 'Reschedule',
        'studentAppointments.cancel': 'Cancel',
        'studentAppointments.cancelTitle': 'Cancel appointment?',
        'studentAppointments.cancelDescription': 'This appointment will be cancelled.',
        'studentAppointments.confirm': 'Confirm',
        'studentAppointments.keep': 'Keep appointment',
        'studentAppointments.timeZone': 'Time zone: {timeZone}',
        'studentAppointments.empty': 'No appointment slots available',
        'studentAppointments.noBooked': 'No booked appointments yet',
        'studentAppointments.loading': 'Loading appointments',
        'studentAppointments.error': 'Unable to load appointments',
        'studentAppointments.retry': 'Retry',
        'studentAppointments.conflict': 'This appointment conflicts with another booking.',
        'studentAppointments.booked': 'Booked',
        'studentAppointments.available': 'Available',
        'studentAppointments.cancelled': 'Cancelled',
        'studentAppointments.completed': 'Completed',
        'studentAppointments.noShow': 'No-show',
        'studentAppointments.recordConsultation': 'Record consultation',
      };
      const translationKey = key.replace('appointments.student.', 'studentAppointments.');
      let value = translations[translationKey] ?? key;
      for (const [name, replacement] of Object.entries(params ?? {})) {
        value = value.replace(`{${name}}`, replacement);
      }
      return value;
    },
  }),
}));
vi.mock('@/components/ui/dialog', () => {
  const Dialog = ({ open, children }: { open?: boolean; children?: ReactNode }) =>
    open ? <div role="dialog">{children}</div> : null;
  const passthrough = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    Dialog,
    DialogContent: passthrough,
    DialogDescription: passthrough,
    DialogFooter: passthrough,
    DialogHeader: passthrough,
    DialogTitle: passthrough,
  };
});

import { StudentAppointmentPanel } from '@/components/student/appointments/StudentAppointmentPanel';

const available = {
  id: 101,
  assignmentId: 10,
  checkpointId: 7,
  checkpointName: 'Proposal',
  instructorId: 'instructor-1',
  studentId: null,
  startAt: new Date('2026-08-09T12:00:00.000Z'),
  endAt: new Date('2026-08-09T13:00:00.000Z'),
  status: 'available' as const,
};

const booked = {
  ...available,
  id: 201,
  studentId: 'student-1',
  status: 'booked' as const,
};

function renderPanel(onRecordConsultation = vi.fn()) {
  return render(
    <StudentAppointmentPanel
      assignmentId={10}
      checkpoints={[{ id: 7, name: 'Proposal' }]}
      onRecordConsultation={onRecordConsultation}
    />,
  );
}

describe('StudentAppointmentPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.listAvailableAppointments.mockResolvedValue({ appointments: [available], total: 1 });
    api.listStudentAppointments.mockResolvedValue({ appointments: [booked], total: 1 });
    api.bookAppointment.mockResolvedValue({ appointment: { ...available, ...booked } });
    api.cancelAppointment.mockResolvedValue({ appointment: { ...booked, status: 'cancelled' } });
    api.rescheduleAppointment.mockResolvedValue({ appointment: booked });
  });

  it('renders available and booked appointments with an explicit timezone label', async () => {
    renderPanel();

    expect(await screen.findByRole('heading', { name: 'Appointments' })).toBeDefined();
    expect(screen.getByText('Available slots')).toBeDefined();
    expect(screen.getByText('Your appointments')).toBeDefined();
    expect(screen.getAllByText('Time zone: America/New_York')).toHaveLength(2);
    expect(screen.getByText('Booked')).toBeDefined();
    expect(mockFormatAppointmentRange).toHaveBeenCalled();
  });

  it('books an available slot and refreshes the appointment lists', async () => {
    renderPanel();

    fireEvent.click(await screen.findByRole('button', { name: 'Book' }));

    await waitFor(() => {
      expect(api.bookAppointment).toHaveBeenCalledWith({
        data: { appointmentId: 101, checkpointId: 7 },
      });
    });
    expect(api.listAvailableAppointments).toHaveBeenCalledTimes(2);
    expect(api.listStudentAppointments).toHaveBeenCalledTimes(2);
  });

  it('allows choosing an optional checkpoint for an assignment-wide slot', async () => {
    api.listAvailableAppointments.mockResolvedValue({
      appointments: [{ ...available, id: 102, checkpointId: null, checkpointName: null }],
      total: 1,
    });
    renderPanel();

    const checkpointSelect = await screen.findByRole('combobox');
    expect(checkpointSelect.className).toContain('min-h-11');
    fireEvent.change(checkpointSelect, { target: { value: '7' } });
    expect((checkpointSelect as HTMLSelectElement).value).toBe('7');
  });

  it('shows a conflict message when booking is rejected by the server', async () => {
    api.bookAppointment.mockResolvedValue({ error: { code: 'CONFLICT', message: 'overlap' } });
    renderPanel();

    fireEvent.click(await screen.findByRole('button', { name: 'Book' }));

    expect(
      await screen.findByText('This appointment conflicts with another booking.'),
    ).toBeDefined();
  });

  it('requires confirmation before cancelling a booked appointment', async () => {
    renderPanel();

    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText('Cancel appointment?')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Keep appointment' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => {
      expect(api.cancelAppointment).toHaveBeenCalledWith({ data: { appointmentId: 201 } });
    });
  });

  it('reschedules a booked appointment into an available replacement slot', async () => {
    renderPanel();

    fireEvent.click(await screen.findByRole('button', { name: 'Reschedule' }));

    await waitFor(() => {
      expect(api.rescheduleAppointment).toHaveBeenCalledWith({
        data: { appointmentId: 201, replacementAppointmentId: 101 },
      });
    });
  });

  it('shows a conflict message when rescheduling is rejected', async () => {
    api.rescheduleAppointment.mockResolvedValue({
      error: { code: 'CONFLICT', message: 'overlap' },
    });
    renderPanel();

    fireEvent.click(await screen.findByRole('button', { name: 'Reschedule' }));

    expect(
      await screen.findByText('This appointment conflicts with another booking.'),
    ).toBeDefined();
  });

  it('shows terminal outcomes and offers explicit consultation evidence recording only', async () => {
    const onRecordConsultation = vi.fn();
    api.listAvailableAppointments.mockResolvedValue({ appointments: [], total: 0 });
    api.listStudentAppointments.mockResolvedValue({
      appointments: [
        { ...booked, status: 'completed' as const },
        { ...booked, id: 202, status: 'no_show' as const },
      ],
      total: 2,
    });
    renderPanel(onRecordConsultation);

    expect(await screen.findByText('Completed')).toBeDefined();
    expect(screen.getByText('No-show')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Record consultation' }));
    expect(onRecordConsultation).toHaveBeenCalledWith(7);
    expect(api.bookAppointment).not.toHaveBeenCalled();
  });

  it('renders cancelled appointments as terminal history', async () => {
    api.listAvailableAppointments.mockResolvedValue({ appointments: [], total: 0 });
    api.listStudentAppointments.mockResolvedValue({
      appointments: [{ ...booked, status: 'cancelled' as const }],
      total: 1,
    });
    renderPanel();

    expect(await screen.findByText('Cancelled')).toBeDefined();
  });

  it('renders loading, empty, and error states', async () => {
    let resolveAvailable: ((value: { appointments: []; total: number }) => void) | undefined;
    api.listAvailableAppointments.mockReturnValue(
      new Promise((resolve) => {
        resolveAvailable = resolve;
      }),
    );
    api.listStudentAppointments.mockResolvedValue({ appointments: [], total: 0 });
    const view = renderPanel();
    expect(screen.getByText('Loading appointments')).toBeDefined();

    resolveAvailable?.({ appointments: [], total: 0 });
    expect(await screen.findByText('No appointment slots available')).toBeDefined();

    view.unmount();
    api.listAvailableAppointments.mockRejectedValue(new Error('network'));
    api.listStudentAppointments.mockRejectedValue(new Error('network'));
    renderPanel();
    expect(await screen.findByText('Unable to load appointments')).toBeDefined();

    api.listAvailableAppointments.mockResolvedValue({ appointments: [], total: 0 });
    api.listStudentAppointments.mockResolvedValue({ appointments: [], total: 0 });
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Available slots')).toBeDefined();
  });
});
