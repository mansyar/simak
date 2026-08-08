/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getDbMock, getSessionMock, isStudentMock } = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  getSessionMock: vi.fn(),
  isStudentMock: vi.fn(),
}));

vi.mock('@/db/index', () => ({ getDb: getDbMock }));
vi.mock('@/server/auth', () => ({ getSessionFromHeaders: getSessionMock }));
vi.mock('@/lib/session-guards', () => ({ isStudent: isStudentMock }));

import {
  listAvailableAppointmentsHandler,
  listStudentAppointmentsHandler,
} from '@/server/appointments-list.server';

const studentSession = { user: { id: 'student-1', role: 'student' } };
const appointment = {
  id: 101,
  assignmentId: 10,
  checkpointId: 7,
  checkpointName: 'Proposal',
  instructorId: 'instructor-1',
  studentId: null,
  startAt: new Date('2030-08-09T12:00:00.000Z'),
  endAt: new Date('2030-08-09T13:00:00.000Z'),
  status: 'available' as const,
};

function createDb(results: unknown[]) {
  const queue = [...results];
  const select = vi.fn(() => {
    const result = queue.shift();
    const query = {
      from: vi.fn(() => query),
      innerJoin: vi.fn(() => query),
      leftJoin: vi.fn(() => query),
      where: vi.fn(() => query),
      orderBy: vi.fn(() => query),
      limit: vi.fn(() => query),
      offset: vi.fn(() => query),
      then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve(result).then(resolve, reject),
    };
    return query;
  });

  return { select };
}

describe('appointment list handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionMock.mockResolvedValue(studentSession);
    isStudentMock.mockReturnValue(true);
  });

  it('rejects non-students before querying available appointments', async () => {
    isStudentMock.mockReturnValue(false);

    const result = await listAvailableAppointmentsHandler({
      data: { assignmentId: 10, page: 1, limit: 20 },
    });

    expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
    expect(getDbMock).not.toHaveBeenCalled();
  });

  it('lists future available slots with optional checkpoint filtering and pagination', async () => {
    getDbMock.mockReturnValue(createDb([[appointment], [{ total: 1 }]]));

    const result = await listAvailableAppointmentsHandler({
      data: { assignmentId: 10, checkpointId: 7, page: 2, limit: 5 },
    });

    expect(result).toEqual({ appointments: [appointment], total: 1, page: 2, limit: 5 });
    expect(getDbMock().select).toHaveBeenCalledTimes(2);
  });

  it('lists available assignment-wide slots when no checkpoint filter is supplied', async () => {
    getDbMock.mockReturnValue(createDb([[{ ...appointment, checkpointId: null }], [{ total: 1 }]]));

    const result = await listAvailableAppointmentsHandler({
      data: { assignmentId: 10, page: 1, limit: 20 },
    });

    expect(result).toMatchObject({ total: 1, appointments: [{ checkpointId: null }] });
  });

  it('returns a generic error when available-slot loading fails', async () => {
    getDbMock.mockImplementation(() => {
      throw new Error('database detail');
    });

    const result = await listAvailableAppointmentsHandler({
      data: { assignmentId: 10, page: 1, limit: 20 },
    });

    expect(result).toEqual({ error: { code: 'INTERNAL', message: 'Internal Server Error' } });
  });

  it('sanitizes non-Error available list failures', async () => {
    getDbMock.mockImplementation(() => {
      throw 'database detail';
    });

    const result = await listAvailableAppointmentsHandler({
      data: { assignmentId: 10, page: 1, limit: 20 },
    });

    expect(result).toEqual({ error: { code: 'INTERNAL', message: 'Internal Server Error' } });
  });

  it('lists the student appointment history with assignment filtering', async () => {
    const bookedAppointment = { ...appointment, studentId: 'student-1', status: 'booked' as const };
    getDbMock.mockReturnValue(createDb([[bookedAppointment], [{ total: 1 }]]));

    const result = await listStudentAppointmentsHandler({
      data: { assignmentId: 10, page: 1, limit: 20 },
    });

    expect(result).toEqual({ appointments: [bookedAppointment], total: 1, page: 1, limit: 20 });
  });

  it('lists the student appointment history without an assignment filter', async () => {
    const bookedAppointment = { ...appointment, studentId: 'student-1', status: 'booked' as const };
    getDbMock.mockReturnValue(createDb([[bookedAppointment], [{ total: 1 }]]));

    const result = await listStudentAppointmentsHandler({
      data: { page: 1, limit: 20 },
    });

    expect(result).toMatchObject({ total: 1, appointments: [bookedAppointment] });
  });

  it('rejects non-students before querying appointment history', async () => {
    isStudentMock.mockReturnValue(false);

    const result = await listStudentAppointmentsHandler({
      data: { page: 1, limit: 20 },
    });

    expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
    expect(getDbMock).not.toHaveBeenCalled();
  });

  it('returns a generic error when appointment history loading fails', async () => {
    getDbMock.mockImplementation(() => {
      throw new Error('database detail');
    });

    const result = await listStudentAppointmentsHandler({
      data: { page: 1, limit: 20 },
    });

    expect(result).toEqual({ error: { code: 'INTERNAL', message: 'Internal Server Error' } });
  });

  it('sanitizes non-Error appointment history failures', async () => {
    getDbMock.mockImplementation(() => {
      throw 'database detail';
    });

    const result = await listStudentAppointmentsHandler({
      data: { page: 1, limit: 20 },
    });

    expect(result).toEqual({ error: { code: 'INTERNAL', message: 'Internal Server Error' } });
  });
});
