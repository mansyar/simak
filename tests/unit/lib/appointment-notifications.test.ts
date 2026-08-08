/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '@/db/index';
import { getNotificationKeys } from '@/lib/i18n-server';
import { logger } from '@/lib/logger';
import { maybeInsertNotification } from '@/lib/notification-prefs';
import { notifyAppointmentParticipants } from '@/lib/appointment-notifications';

vi.mock('@/db/index', () => ({ getDb: vi.fn() }));
vi.mock('@/lib/i18n-server', () => ({
  getNotificationKeys: vi.fn((type: string) => ({
    titleKey: `notifications.events.${type}.title`,
    messageKey: `notifications.events.${type}.message`,
  })),
}));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }));
vi.mock('@/lib/notification-prefs', () => ({ maybeInsertNotification: vi.fn() }));

describe('appointment participant notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDb).mockReturnValue({} as never);
    vi.mocked(maybeInsertNotification).mockResolvedValue(undefined);
  });

  it('creates preference-aware in-app notifications once per participant', async () => {
    const startAt = new Date('2026-08-08T12:00:00.000Z');
    const endAt = new Date('2026-08-08T13:00:00.000Z');

    await notifyAppointmentParticipants({
      event: 'appointment_rescheduled',
      appointmentId: 401,
      assignmentId: 10,
      checkpointId: 7,
      participantIds: ['student-1', 'instructor-1', 'student-1'],
      startAt,
      endAt,
    });

    expect(getNotificationKeys).toHaveBeenCalledWith('appointment_rescheduled');
    expect(maybeInsertNotification).toHaveBeenCalledTimes(2);
    expect(maybeInsertNotification).toHaveBeenCalledWith(
      {},
      'student-1',
      'appointment_rescheduled',
      expect.objectContaining({
        userId: 'student-1',
        type: 'appointment_rescheduled',
        titleKey: 'notifications.events.appointment_rescheduled.title',
        messageKey: 'notifications.events.appointment_rescheduled.message',
        params: {
          appointmentId: '401',
          assignmentId: '10',
          checkpointId: '7',
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
        },
        metadata: { appointmentId: 401, assignmentId: 10, checkpointId: 7 },
      }),
    );
  });

  it('isolates a notification failure and never includes private consultation notes', async () => {
    vi.mocked(maybeInsertNotification)
      .mockRejectedValueOnce(new Error('notification unavailable'))
      .mockResolvedValueOnce(undefined);

    await notifyAppointmentParticipants({
      event: 'appointment_cancelled',
      appointmentId: 401,
      assignmentId: 10,
      participantIds: ['student-1', 'instructor-1'],
      startAt: new Date('2026-08-08T12:00:00.000Z'),
      endAt: new Date('2026-08-08T13:00:00.000Z'),
    });

    expect(maybeInsertNotification).toHaveBeenCalledTimes(2);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'advisory_failed',
        handler: 'notifyAppointmentParticipants',
      }),
    );
    expect(JSON.stringify(vi.mocked(maybeInsertNotification).mock.calls)).not.toContain(
      'consultation',
    );
  });

  it('does not open the database when no participant remains after deduplication', async () => {
    await notifyAppointmentParticipants({
      event: 'appointment_booked',
      appointmentId: 401,
      assignmentId: 10,
      participantIds: ['', ''],
      startAt: new Date('2026-08-08T12:00:00.000Z'),
      endAt: new Date('2026-08-08T13:00:00.000Z'),
    });

    expect(getDb).not.toHaveBeenCalled();
    expect(maybeInsertNotification).not.toHaveBeenCalled();
  });

  it('isolates a database acquisition failure as advisory work', async () => {
    vi.mocked(getDb).mockImplementation(() => {
      throw new Error('database unavailable');
    });

    await notifyAppointmentParticipants({
      event: 'appointment_reminder_1h',
      appointmentId: 401,
      assignmentId: 10,
      participantIds: ['student-1'],
      startAt: new Date('2026-08-08T12:00:00.000Z'),
      endAt: new Date('2026-08-08T13:00:00.000Z'),
    });

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'advisory_failed',
        error: 'database unavailable',
      }),
    );
  });
});
