/** @vitest-environment node */
import { describe, expect, it } from 'vitest';
import { buildAppointmentEmailBody } from '@/lib/appointment-email';

describe('appointment email body', () => {
  it('renders localized lifecycle content using UTC parameters without private notes', () => {
    const body = buildAppointmentEmailBody(
      'appointment_completed',
      {
        appointmentId: '401',
        assignmentId: '10',
        startAt: '2026-08-08T12:00:00.000Z',
        endAt: '2026-08-08T13:00:00.000Z',
      },
      'id',
    );

    expect(body).toContain('Janji Temu Selesai');
    expect(body).toContain('2026-08-08T12:00:00.000Z');
    expect(body).not.toContain('consultation');
    expect(body).not.toContain('notes');
  });
});
