/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '@/db/index';
import { notifyAppointmentParticipants } from '@/lib/appointment-notifications';
import { safeAuditLog } from '@/lib/audit';
import { getSessionFromHeaders } from '@/server/auth';
import {
  completeAppointmentHandler,
  markAppointmentNoShowHandler,
} from '@/server/appointments-lifecycle.server';

vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn(),
}));

vi.mock('@/db/index', () => ({
  getDb: vi.fn(),
}));

vi.mock('@/lib/audit', () => ({
  safeAuditLog: vi.fn(),
}));

vi.mock('@/lib/appointment-notifications', () => ({
  notifyAppointmentParticipants: vi.fn().mockResolvedValue(undefined),
}));

const instructorSession = {
  user: { id: 'instructor-1', role: 'instructor' as const },
  session: {},
};

const studentSession = {
  user: { id: 'student-1', role: 'student' as const },
  session: {},
};

const pastStart = new Date(Date.now() - 2 * 60 * 60_000);
const pastEnd = new Date(Date.now() - 60 * 60_000);
const futureStart = new Date(Date.now() + 60 * 60_000);
const futureEnd = new Date(futureStart.getTime() + 30 * 60_000);

const bookedAppointment = {
  id: 501,
  assignmentId: 10,
  checkpointId: 7,
  instructorId: 'instructor-1',
  studentId: 'student-1',
  startAt: pastStart,
  endAt: pastEnd,
  status: 'booked' as const,
  createdAt: pastStart,
  updatedAt: pastStart,
};

function createMockDb() {
  return {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    for: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    transaction: vi.fn(),
    then: vi.fn(),
  };
}

type MockDb = ReturnType<typeof createMockDb>;

function queueResults(mockDb: MockDb, results: unknown[]) {
  mockDb.then.mockImplementation((onFulfilled: (value: unknown) => unknown) =>
    Promise.resolve(results.shift() ?? []).then(onFulfilled),
  );
}

function queueTransaction(mockDb: MockDb, results: unknown[]) {
  const transactionDb = createMockDb();
  queueResults(transactionDb, results);
  mockDb.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
    callback(transactionDb),
  );
  return transactionDb;
}

describe('appointment completion and no-show transitions', () => {
  let mockDb: MockDb;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    vi.mocked(getDb).mockReturnValue(mockDb as never);
    vi.mocked(getSessionFromHeaders).mockResolvedValue(instructorSession as never);
  });

  it.each([
    ['completed', completeAppointmentHandler, 'appointment.completed'],
    ['no_show', markAppointmentNoShowHandler, 'appointment.no_show'],
  ] as const)(
    'allows an instructor to mark an ended booking %s',
    async (status, handler, action) => {
      const updatedAppointment = { ...bookedAppointment, status };
      const transactionDb = queueTransaction(mockDb, [[bookedAppointment], [updatedAppointment]]);

      const result = await handler({ data: { appointmentId: bookedAppointment.id } });

      expect(result).toEqual({ appointment: updatedAppointment });
      expect(transactionDb.update).toHaveBeenCalledOnce();
      expect(safeAuditLog).toHaveBeenCalledWith(
        action,
        expect.objectContaining({
          actorId: instructorSession.user.id,
          details: expect.objectContaining({
            beforeStatus: 'booked',
            afterStatus: status,
          }),
        }),
      );
      expect(notifyAppointmentParticipants).toHaveBeenCalledWith(
        expect.objectContaining({
          event: status === 'completed' ? 'appointment_completed' : 'appointment_no_show',
          appointmentId: bookedAppointment.id,
          participantIds: ['student-1', 'instructor-1'],
        }),
      );
      expect(mockDb.insert).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['student', studentSession, completeAppointmentHandler],
    ['student', studentSession, markAppointmentNoShowHandler],
    ['unauthenticated', null, completeAppointmentHandler],
  ] as const)(
    'rejects %s lifecycle mutation before querying the database',
    async (_label, session, handler) => {
      vi.mocked(getSessionFromHeaders).mockResolvedValue(session as never);

      const result = await handler({ data: { appointmentId: bookedAppointment.id } });

      expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      expect(getDb).not.toHaveBeenCalled();
    },
  );

  it('rejects a booking that has not ended yet', async () => {
    const futureAppointment = {
      ...bookedAppointment,
      startAt: futureStart,
      endAt: futureEnd,
    };
    const transactionDb = queueTransaction(mockDb, [[futureAppointment]]);

    const result = await completeAppointmentHandler({
      data: { appointmentId: futureAppointment.id },
    });

    expect(result).toEqual({
      error: { code: 'CONFLICT', message: 'Appointment cannot be completed in its current state' },
    });
    expect(transactionDb.update).not.toHaveBeenCalled();
    expect(safeAuditLog).not.toHaveBeenCalled();
  });

  it('rejects invalid lifecycle states without changing the appointment', async () => {
    const availableAppointment = { ...bookedAppointment, status: 'available' as const };
    const transactionDb = queueTransaction(mockDb, [[availableAppointment]]);

    const result = await markAppointmentNoShowHandler({
      data: { appointmentId: availableAppointment.id },
    });

    expect(result).toEqual({
      error: {
        code: 'CONFLICT',
        message: 'Appointment cannot be marked as no-show in its current state',
      },
    });
    expect(transactionDb.update).not.toHaveBeenCalled();
  });

  it('preserves the appointment when the guarded transition loses a race', async () => {
    const transactionDb = queueTransaction(mockDb, [[bookedAppointment], []]);

    const result = await completeAppointmentHandler({
      data: { appointmentId: bookedAppointment.id },
    });

    expect(result).toEqual({
      error: { code: 'CONFLICT', message: 'Appointment state changed; please try again' },
    });
    expect(transactionDb.update).toHaveBeenCalledOnce();
    expect(safeAuditLog).not.toHaveBeenCalled();
  });

  it('returns a generic internal error when the transition transaction fails', async () => {
    mockDb.transaction.mockRejectedValue(new Error('database unavailable'));

    const result = await markAppointmentNoShowHandler({
      data: { appointmentId: bookedAppointment.id },
    });

    expect(result).toEqual({ error: { code: 'INTERNAL', message: 'Internal Server Error' } });
  });
});
