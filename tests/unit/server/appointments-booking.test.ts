/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getSessionFromHeaders } from '@/server/auth';
import { getDb } from '@/db/index';
import { safeAuditLog } from '@/lib/audit';
import { bookAppointmentHandler } from '@/server/appointments-lifecycle.server';

vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn(),
}));

vi.mock('@/db/index', () => ({
  getDb: vi.fn(),
}));

vi.mock('@/lib/audit', () => ({
  safeAuditLog: vi.fn(),
}));

const studentSession = {
  user: { id: 'student-1', role: 'student' as const },
  session: {},
};

const futureStart = new Date(Date.now() + 60 * 60_000);
const futureEnd = new Date(futureStart.getTime() + 30 * 60_000);

const availableAppointment = {
  id: 301,
  assignmentId: 10,
  checkpointId: null,
  instructorId: 'instructor-1',
  studentId: null,
  startAt: futureStart,
  endAt: futureEnd,
  status: 'available' as const,
  createdAt: futureStart,
  updatedAt: futureStart,
};

const bookedAppointment = {
  ...availableAppointment,
  checkpointId: 7,
  studentId: 'student-1',
  status: 'booked' as const,
};

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

function queueConcurrentTransactions(mockDb: MockDb, queues: unknown[][]) {
  const transactions = queues.map((results) => {
    const transactionDb = createMockDb();
    queueResults(transactionDb, results);
    return transactionDb;
  });
  mockDb.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
    callback(transactions.shift()),
  );
  return transactions;
}

function successfulBookingQueue(checkpoint = false) {
  return [
    [availableAppointment],
    [{ id: 'instructor-1' }],
    [{ id: 'student-1' }],
    [{ id: 501 }],
    ...(checkpoint ? [[{ id: 7 }]] : []),
    [],
    [],
    [bookedAppointment],
  ];
}

describe('Student appointment booking handler', () => {
  let mockDb: MockDb;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    vi.mocked(getDb).mockReturnValue(mockDb as never);
    vi.mocked(getSessionFromHeaders).mockResolvedValue(studentSession as never);
  });

  it('books an eligible available slot and optionally links a same-assignment checkpoint', async () => {
    const transactionDb = queueTransaction(mockDb, successfulBookingQueue(true));

    const result = await bookAppointmentHandler({
      data: { appointmentId: 301, checkpointId: 7 },
    });

    expect(result).toEqual({ appointment: bookedAppointment });
    expect(transactionDb.update).toHaveBeenCalledTimes(1);
    expect(transactionDb.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'booked',
        studentId: 'student-1',
        checkpointId: 7,
      }),
    );
    expect(safeAuditLog).toHaveBeenCalledWith('appointment.booked', {
      actorId: 'student-1',
      action: 'appointment.booked',
      entityType: 'appointment',
      entityId: '301',
      details: {
        beforeStatus: 'available',
        afterStatus: 'booked',
        assignmentId: 10,
        checkpointId: 7,
      },
    });
  });

  it('books without a checkpoint when the student leaves the optional link empty', async () => {
    const transactionDb = queueTransaction(mockDb, successfulBookingQueue());

    const result = await bookAppointmentHandler({ data: { appointmentId: 301 } });

    expect(result).toEqual({ appointment: { ...bookedAppointment, checkpointId: null } });
    expect(transactionDb.set).toHaveBeenCalledWith(
      expect.objectContaining({ checkpointId: null, studentId: 'student-1' }),
    );
  });

  it.each([
    [null, 'unauthenticated'],
    [{ ...studentSession, user: { ...studentSession.user, role: 'instructor' } }, 'instructor'],
    [{ ...studentSession, user: { ...studentSession.user, role: 'admin' } }, 'admin'],
  ])('rejects %s access without opening a transaction', async (session, _label) => {
    vi.mocked(getSessionFromHeaders).mockResolvedValue(session as never);

    const result = await bookAppointmentHandler({ data: { appointmentId: 301 } });

    expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
    expect(getDb).not.toHaveBeenCalled();
  });

  it('hides an appointment for an unrelated, inactive, or otherwise ineligible student', async () => {
    const transactionDb = queueTransaction(mockDb, [[]]);

    const result = await bookAppointmentHandler({ data: { appointmentId: 301 } });

    expect(result).toEqual({ error: { code: 'NOT_FOUND', message: 'Appointment not found' } });
    expect(transactionDb.update).not.toHaveBeenCalled();
  });

  it('rejects a checkpoint that is not owned by the student in the appointment assignment', async () => {
    const transactionDb = queueTransaction(mockDb, [[availableAppointment], []]);

    const result = await bookAppointmentHandler({
      data: { appointmentId: 301, checkpointId: 999 },
    });

    expect(result).toEqual({ error: { code: 'NOT_FOUND', message: 'Checkpoint not found' } });
    expect(transactionDb.update).not.toHaveBeenCalled();
  });

  it('rejects a booked or cancelled slot without changing its original state', async () => {
    const transactionDb = queueTransaction(mockDb, [
      [{ ...availableAppointment, status: 'booked' }],
    ]);

    const result = await bookAppointmentHandler({ data: { appointmentId: 301 } });

    expect(result).toEqual({
      error: { code: 'CONFLICT', message: 'Appointment is no longer available' },
    });
    expect(transactionDb.update).not.toHaveBeenCalled();
    expect(safeAuditLog).not.toHaveBeenCalled();
  });

  it('rejects a future slot that overlaps another appointment for the instructor', async () => {
    const transactionDb = queueTransaction(mockDb, [
      [availableAppointment],
      [{ id: 'instructor-1' }],
      [{ id: 'student-1' }],
      [{ id: 501 }],
      [{ id: 302 }],
    ]);

    const result = await bookAppointmentHandler({ data: { appointmentId: 301 } });

    expect(result).toEqual({
      error: { code: 'CONFLICT', message: 'Appointment conflicts with an existing booking' },
    });
    expect(transactionDb.update).not.toHaveBeenCalled();
  });

  it('rejects a future slot that overlaps another appointment for the student', async () => {
    const transactionDb = queueTransaction(mockDb, [
      [availableAppointment],
      [{ id: 'instructor-1' }],
      [{ id: 'student-1' }],
      [{ id: 501 }],
      [],
      [{ id: 303 }],
    ]);

    const result = await bookAppointmentHandler({ data: { appointmentId: 301 } });

    expect(result).toEqual({
      error: { code: 'CONFLICT', message: 'Appointment conflicts with an existing booking' },
    });
    expect(transactionDb.update).not.toHaveBeenCalled();
  });

  it('allows a slot when cancelled appointments are the only overlapping records', async () => {
    const transactionDb = queueTransaction(mockDb, successfulBookingQueue());

    const result = await bookAppointmentHandler({ data: { appointmentId: 301 } });

    expect(result).toHaveProperty('appointment.status', 'booked');
    expect(transactionDb.update).toHaveBeenCalledTimes(1);
  });

  it('allows one winner when concurrent requests race for the same slot', async () => {
    const transactions = queueConcurrentTransactions(mockDb, [
      successfulBookingQueue(),
      [{ ...bookedAppointment, checkpointId: null }],
    ]);

    const results = await Promise.all([
      bookAppointmentHandler({ data: { appointmentId: 301 } }),
      bookAppointmentHandler({ data: { appointmentId: 301 } }),
    ]);

    expect(results.filter((result) => 'appointment' in result)).toHaveLength(1);
    expect(results.filter((result) => 'error' in result)).toEqual([
      { error: { code: 'CONFLICT', message: 'Appointment is no longer available' } },
    ]);
    expect(transactions).toHaveLength(0);
  });
});
