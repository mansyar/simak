/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getSessionFromHeaders } from '@/server/auth';
import { getDb } from '@/db/index';
import { safeAuditLog } from '@/lib/audit';
import { notifyAppointmentParticipants } from '@/lib/appointment-notifications';
import { cancelAppointmentHandler } from '@/server/appointments.server';
import { cancelStudentAppointmentHandler } from '@/server/appointments-cancellation.server';
import { rescheduleAppointmentHandler } from '@/server/appointments-rescheduling.server';

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

const originalStart = new Date(Date.now() + 60 * 60_000);
const originalEnd = new Date(originalStart.getTime() + 30 * 60_000);
const replacementStart = new Date(Date.now() + 4 * 60 * 60_000);
const replacementEnd = new Date(replacementStart.getTime() + 30 * 60_000);

const bookedAppointment = {
  id: 401,
  assignmentId: 10,
  checkpointId: 7,
  instructorId: 'instructor-1',
  studentId: 'student-1',
  startAt: originalStart,
  endAt: originalEnd,
  status: 'booked' as const,
  createdAt: originalStart,
  updatedAt: originalStart,
};

const availableReplacement = {
  id: 402,
  assignmentId: 10,
  checkpointId: null,
  instructorId: 'instructor-1',
  studentId: null,
  startAt: replacementStart,
  endAt: replacementEnd,
  status: 'available' as const,
  createdAt: replacementStart,
  updatedAt: replacementStart,
};

const cancelledAppointment = { ...bookedAppointment, status: 'cancelled' as const };

function createMockDb() {
  return {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    for: vi.fn().mockReturnThis(),
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

describe('Booked appointment cancellation', () => {
  let mockDb: MockDb;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    vi.mocked(getDb).mockReturnValue(mockDb as never);
    vi.mocked(getSessionFromHeaders).mockResolvedValue(studentSession as never);
  });

  it('lets a student cancel their own future appointment and preserves the evidence boundary', async () => {
    const transactionDb = queueTransaction(mockDb, [[bookedAppointment], [cancelledAppointment]]);

    const result = await cancelAppointmentHandler({
      data: { appointmentId: 401, reason: 'Private consultation note' },
    });

    expect(result).toEqual({
      appointment: { ...cancelledAppointment, studentName: null, studentEmail: null },
    });
    expect(transactionDb.update).toHaveBeenCalledTimes(1);
    expect(safeAuditLog).toHaveBeenCalledWith('appointment.cancelled', {
      actorId: 'student-1',
      action: 'appointment.cancelled',
      entityType: 'appointment',
      entityId: '401',
      details: { assignmentId: 10, beforeStatus: 'booked', afterStatus: 'cancelled' },
    });
    expect(JSON.stringify(vi.mocked(safeAuditLog).mock.calls[0])).not.toContain(
      'Private consultation note',
    );
    expect(notifyAppointmentParticipants).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'appointment_cancelled',
        participantIds: ['student-1', 'instructor-1'],
      }),
    );
  });

  it('lets the owning instructor cancel a booked appointment', async () => {
    vi.mocked(getSessionFromHeaders).mockResolvedValue(instructorSession as never);
    const transactionDb = queueTransaction(mockDb, [[bookedAppointment], [cancelledAppointment]]);

    const result = await cancelAppointmentHandler({ data: { appointmentId: 401 } });

    expect(result).toHaveProperty('appointment.status', 'cancelled');
    expect(transactionDb.update).toHaveBeenCalledTimes(1);
  });

  it('rejects cancellation after the appointment starts without mutating it', async () => {
    const pastAppointment = {
      ...bookedAppointment,
      startAt: new Date(Date.now() - 30 * 60_000),
      endAt: new Date(Date.now() - 1 * 60_000),
    };
    const transactionDb = queueTransaction(mockDb, [[pastAppointment]]);

    const result = await cancelAppointmentHandler({ data: { appointmentId: 401 } });

    expect(result).toEqual({
      error: { code: 'BAD_REQUEST', message: 'Appointment can no longer be cancelled' },
    });
    expect(transactionDb.update).not.toHaveBeenCalled();
  });

  it('does not enumerate a booked appointment owned by another student', async () => {
    const transactionDb = queueTransaction(mockDb, [[]]);

    const result = await cancelAppointmentHandler({ data: { appointmentId: 401 } });

    expect(result).toEqual({ error: { code: 'NOT_FOUND', message: 'Appointment not found' } });
    expect(transactionDb.update).not.toHaveBeenCalled();
  });

  it('returns an already-cancelled appointment idempotently without a second audit', async () => {
    const transactionDb = queueTransaction(mockDb, [[cancelledAppointment]]);

    const result = await cancelAppointmentHandler({ data: { appointmentId: 401 } });

    expect(result).toHaveProperty('appointment.status', 'cancelled');
    expect(transactionDb.update).not.toHaveBeenCalled();
    expect(safeAuditLog).not.toHaveBeenCalled();
  });

  it('rejects a stale cancellation update without auditing a state change', async () => {
    const transactionDb = queueTransaction(mockDb, [[bookedAppointment], []]);

    const result = await cancelAppointmentHandler({ data: { appointmentId: 401 } });

    expect(result).toEqual({
      error: { code: 'CONFLICT', message: 'Appointment state changed; please try again' },
    });
    expect(safeAuditLog).not.toHaveBeenCalled();
    expect(transactionDb.update).toHaveBeenCalledTimes(1);
  });

  it('returns a generic internal error when student cancellation cannot commit', async () => {
    mockDb.transaction.mockRejectedValue(new Error('database unavailable'));

    const result = await cancelAppointmentHandler({ data: { appointmentId: 401 } });

    expect(result).toEqual({ error: { code: 'INTERNAL', message: 'Internal Server Error' } });
  });

  it('rejects direct student-cancellation calls from non-students', async () => {
    vi.mocked(getSessionFromHeaders).mockResolvedValue(null as never);

    const result = await cancelStudentAppointmentHandler({ data: { appointmentId: 401 } });

    expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
    expect(getDb).not.toHaveBeenCalled();
  });

  it('rejects a student cancellation when the locked appointment is not booked', async () => {
    const transactionDb = queueTransaction(mockDb, [
      [{ ...bookedAppointment, status: 'available' }],
    ]);

    const result = await cancelStudentAppointmentHandler({ data: { appointmentId: 401 } });

    expect(result).toEqual({
      error: { code: 'CONFLICT', message: 'Appointment cannot be cancelled in its current state' },
    });
    expect(transactionDb.update).not.toHaveBeenCalled();
  });
});

describe('Appointment rescheduling', () => {
  let mockDb: MockDb;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    vi.mocked(getDb).mockReturnValue(mockDb as never);
    vi.mocked(getSessionFromHeaders).mockResolvedValue(studentSession as never);
  });

  function successQueue() {
    return [
      [bookedAppointment, availableReplacement],
      [{ id: 'instructor-1' }],
      [{ id: 'student-1' }],
      [{ id: 501 }],
      [],
      [],
      [{ ...bookedAppointment, startAt: replacementStart, endAt: replacementEnd }],
      [{ ...availableReplacement, status: 'cancelled' as const }],
    ];
  }

  it('moves the booked appointment to another same-assignment slot while retaining its identity', async () => {
    const transactionDb = queueTransaction(mockDb, successQueue());

    const result = await rescheduleAppointmentHandler({
      data: { appointmentId: 401, replacementAppointmentId: 402 },
    });

    expect(result).toEqual({
      appointment: { ...bookedAppointment, startAt: replacementStart, endAt: replacementEnd },
    });
    expect(transactionDb.update).toHaveBeenCalledTimes(2);
    expect(transactionDb.set).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ startAt: replacementStart, endAt: replacementEnd }),
    );
    expect(transactionDb.set).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ status: 'cancelled' }),
    );
    expect(safeAuditLog).toHaveBeenCalledWith('appointment.rescheduled', {
      actorId: 'student-1',
      action: 'appointment.rescheduled',
      entityType: 'appointment',
      entityId: '401',
      details: {
        assignmentId: 10,
        replacementAppointmentId: 402,
        beforeStartAt: originalStart,
        beforeEndAt: originalEnd,
        afterStartAt: replacementStart,
        afterEndAt: replacementEnd,
      },
    });
    expect(notifyAppointmentParticipants).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'appointment_rescheduled',
        appointmentId: 401,
        participantIds: ['student-1', 'instructor-1'],
        startAt: replacementStart,
        endAt: replacementEnd,
      }),
    );
  });

  it('allows the owning instructor to change a booked appointment time', async () => {
    vi.mocked(getSessionFromHeaders).mockResolvedValue(instructorSession as never);
    const transactionDb = queueTransaction(mockDb, successQueue());

    const result = await rescheduleAppointmentHandler({
      data: { appointmentId: 401, replacementAppointmentId: 402 },
    });

    expect(result).toHaveProperty('appointment.id', 401);
    expect(transactionDb.update).toHaveBeenCalledTimes(2);
  });

  it('rejects a replacement that conflicts with another booked appointment and preserves both slots', async () => {
    const transactionDb = queueTransaction(mockDb, [
      [bookedAppointment, availableReplacement],
      [{ id: 'instructor-1' }],
      [{ id: 'student-1' }],
      [{ id: 501 }],
      [{ id: 499 }],
    ]);

    const result = await rescheduleAppointmentHandler({
      data: { appointmentId: 401, replacementAppointmentId: 402 },
    });

    expect(result).toEqual({
      error: { code: 'CONFLICT', message: 'Appointment conflicts with an existing booking' },
    });
    expect(transactionDb.update).not.toHaveBeenCalled();
    expect(safeAuditLog).not.toHaveBeenCalled();
  });

  it('rejects past or unavailable appointments without changing the original identity', async () => {
    const pastAppointment = {
      ...bookedAppointment,
      startAt: new Date(Date.now() - 30 * 60_000),
      endAt: new Date(Date.now() - 1 * 60_000),
    };
    const transactionDb = queueTransaction(mockDb, [[pastAppointment, availableReplacement]]);

    const result = await rescheduleAppointmentHandler({
      data: { appointmentId: 401, replacementAppointmentId: 402 },
    });

    expect(result).toEqual({
      error: { code: 'BAD_REQUEST', message: 'Appointment can no longer be rescheduled' },
    });
    expect(transactionDb.update).not.toHaveBeenCalled();
  });

  it('rejects unauthorized roles before opening a transaction', async () => {
    vi.mocked(getSessionFromHeaders).mockResolvedValue(null as never);

    const result = await rescheduleAppointmentHandler({
      data: { appointmentId: 401, replacementAppointmentId: 402 },
    });

    expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
    expect(getDb).not.toHaveBeenCalled();
  });

  it('does not let a student reschedule another student appointment in the same assignment', async () => {
    const transactionDb = queueTransaction(mockDb, [[]]);

    const result = await rescheduleAppointmentHandler({
      data: { appointmentId: 401, replacementAppointmentId: 402 },
    });

    expect(result).toEqual({ error: { code: 'NOT_FOUND', message: 'Appointment not found' } });
    expect(transactionDb.update).not.toHaveBeenCalled();
  });
});
