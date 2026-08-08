/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '@/db/index';
import { notifyAppointmentParticipants } from '@/lib/appointment-notifications';
import {
  isAppointmentReminderEligible,
  processAppointmentReminders,
} from '@/lib/appointment-reminder-scanner';
import { logger } from '@/lib/logger';

vi.mock('@/db/index', () => ({ getDb: vi.fn() }));
vi.mock('@/lib/appointment-notifications', () => ({
  notifyAppointmentParticipants: vi.fn(),
}));
vi.mock('@/lib/logger', () => ({
  logger: {
    child: vi.fn(() => ({ error: vi.fn() })),
  },
}));

type MockDb = ReturnType<typeof createMockDb>;

function createMockDb() {
  const db = {
    select: vi.fn(),
    from: vi.fn(),
    innerJoin: vi.fn(),
    where: vi.fn(),
    insert: vi.fn(),
    values: vi.fn(),
    onConflictDoNothing: vi.fn(),
    returning: vi.fn(),
    transaction: vi.fn(),
    then: vi.fn(),
  } as Record<string, ReturnType<typeof vi.fn>> & {
    then: ReturnType<typeof vi.fn>;
  };

  for (const method of [
    'select',
    'from',
    'innerJoin',
    'where',
    'insert',
    'values',
    'onConflictDoNothing',
    'returning',
  ]) {
    db[method].mockReturnValue(db);
  }
  db.transaction.mockImplementation(async (callback: (tx: MockDb) => Promise<unknown>) =>
    callback(db),
  );
  db.then.mockImplementation((onfulfilled: (value: unknown) => unknown) =>
    Promise.resolve([]).then(onfulfilled),
  );

  return db;
}

function queueResults(db: MockDb, ...results: unknown[]) {
  db.then.mockImplementation((onfulfilled: (value: unknown) => unknown) =>
    Promise.resolve(results.shift() ?? []).then(onfulfilled),
  );
}

const now = new Date('2026-08-08T00:00:00.000Z');
const appointment24h = {
  appointmentId: 401,
  assignmentId: 10,
  checkpointId: null,
  instructorId: 'instructor-1',
  studentId: 'student-1',
  startAt: new Date('2026-08-09T00:00:00.000Z'),
  endAt: new Date('2026-08-09T01:00:00.000Z'),
  status: 'booked' as const,
};
const appointment1h = {
  ...appointment24h,
  appointmentId: 402,
  startAt: new Date('2026-08-08T01:00:00.000Z'),
  endAt: new Date('2026-08-08T02:00:00.000Z'),
};

describe('appointment reminder scanner', () => {
  let db: MockDb;

  beforeEach(() => {
    vi.clearAllMocks();
    db = createMockDb();
    vi.mocked(getDb).mockReturnValue(db as never);
    vi.mocked(notifyAppointmentParticipants).mockResolvedValue(undefined);
  });

  it('dispatches one 24-hour and one 1-hour reminder window using UTC instants', async () => {
    queueResults(
      db,
      [appointment24h],
      [
        { appointmentId: 401, participantId: 'student-1', tier: '24h' },
        { appointmentId: 401, participantId: 'instructor-1', tier: '24h' },
        { appointmentId: 401, participantId: 'student-1', tier: '24h' },
      ],
      [appointment1h],
      [
        { appointmentId: 402, participantId: 'student-1', tier: '1h' },
        { appointmentId: 402, participantId: 'instructor-1', tier: '1h' },
      ],
    );

    await processAppointmentReminders(now);

    expect(notifyAppointmentParticipants).toHaveBeenCalledTimes(2);
    expect(notifyAppointmentParticipants).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        event: 'appointment_reminder_24h',
        appointmentId: 401,
        participantIds: ['student-1', 'instructor-1'],
        startAt: appointment24h.startAt,
      }),
    );
    expect(notifyAppointmentParticipants).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        event: 'appointment_reminder_1h',
        appointmentId: 402,
        participantIds: ['student-1', 'instructor-1'],
        startAt: appointment1h.startAt,
      }),
    );
  });

  it('does not redispatch reminders when durable deduplication returns no winners', async () => {
    queueResults(db, [appointment24h], [], []);

    await processAppointmentReminders(now);

    expect(notifyAppointmentParticipants).not.toHaveBeenCalled();
  });

  it('skips candidates without a participant after the database eligibility filter', async () => {
    queueResults(db, [{ ...appointment24h, studentId: null }], [], []);

    await processAppointmentReminders(now);

    expect(notifyAppointmentParticipants).not.toHaveBeenCalled();
  });

  it('isolates a failure in one reminder window and continues the next window', async () => {
    const error = new Error('reminder query unavailable');
    db.then.mockImplementationOnce(
      (_onfulfilled: (value: unknown) => unknown, onrejected?: (reason: unknown) => unknown) => {
        onrejected?.(error);
      },
    );

    await expect(processAppointmentReminders(now)).resolves.toBeUndefined();

    const childLogger = vi.mocked(logger.child).mock.results[0]?.value as {
      error: ReturnType<typeof vi.fn>;
    };
    expect(childLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'appointment_reminder.scan_error', tier: '24h' }),
    );
  });

  it('uses half-open UTC windows and excludes cancelled or completed appointments', () => {
    expect(
      isAppointmentReminderEligible(
        { ...appointment24h, startAt: new Date('2026-08-08T23:00:00.000Z') },
        now,
        '24h',
      ),
    ).toBe(false);
    expect(
      isAppointmentReminderEligible(
        { ...appointment24h, startAt: new Date('2026-08-09T00:00:00.000Z') },
        now,
        '24h',
      ),
    ).toBe(true);
    expect(
      isAppointmentReminderEligible({ ...appointment24h, status: 'cancelled' }, now, '24h'),
    ).toBe(false);
    expect(
      isAppointmentReminderEligible({ ...appointment24h, status: 'available' }, now, '24h'),
    ).toBe(false);
    expect(
      isAppointmentReminderEligible({ ...appointment24h, status: 'completed' }, now, '24h'),
    ).toBe(false);
    expect(
      isAppointmentReminderEligible({ ...appointment24h, status: 'no_show' }, now, '24h'),
    ).toBe(false);
  });

  it('logs scan failures and does not reject the queue tick', async () => {
    const error = new Error('database unavailable');
    vi.mocked(getDb).mockImplementationOnce(() => {
      throw error;
    });

    await expect(processAppointmentReminders(now)).resolves.toBeUndefined();

    const childLogger = vi.mocked(logger.child).mock.results[0]?.value as {
      error: ReturnType<typeof vi.fn>;
    };
    expect(childLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'appointment_reminder.scan_error' }),
    );
  });
});
