/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getDbMock, getSessionMock } = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  getSessionMock: vi.fn(),
}));

vi.mock('@/db/index', () => ({ getDb: getDbMock }));
vi.mock('@/server/auth', () => ({ getSessionFromHeaders: getSessionMock }));

import { getAppointmentDetailHandler } from '@/server/appointments-detail.server';

const studentSession = { user: { id: 'student-1', role: 'student' } };
const instructorSession = { user: { id: 'instructor-1', role: 'instructor' } };
const detail = {
  id: 401,
  assignmentId: 10,
  checkpointId: 7,
  checkpointName: 'Proposal',
  instructorId: 'instructor-1',
  studentId: 'student-1',
  studentName: 'Student One',
  studentEmail: 'student@example.com',
  startAt: new Date('2030-08-09T12:00:00.000Z'),
  endAt: new Date('2030-08-09T13:00:00.000Z'),
  status: 'booked' as const,
  createdAt: new Date('2030-08-01T12:00:00.000Z'),
  updatedAt: new Date('2030-08-01T12:00:00.000Z'),
};

function createDb(result: unknown) {
  const select = vi.fn(() => {
    const query = {
      from: vi.fn(() => query),
      innerJoin: vi.fn(() => query),
      leftJoin: vi.fn(() => query),
      where: vi.fn(() => query),
      limit: vi.fn(() => query),
      then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve(result).then(resolve, reject),
    };
    return query;
  });

  return { select };
}

describe('appointment detail handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionMock.mockResolvedValue(studentSession);
  });

  it('rejects unauthenticated and unsupported roles before querying', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'admin-1', role: 'admin' } });

    const result = await getAppointmentDetailHandler({ data: { appointmentId: 401 } });

    expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
    expect(getDbMock).not.toHaveBeenCalled();
  });

  it('returns a student-owned detail projection', async () => {
    const db = createDb([detail]);
    getDbMock.mockReturnValue(db);

    const result = await getAppointmentDetailHandler({ data: { appointmentId: 401 } });

    expect(result).toEqual({ appointment: detail });
    expect(db.select).toHaveBeenCalledTimes(1);
  });

  it('returns an instructor-owned detail projection', async () => {
    getSessionMock.mockResolvedValue(instructorSession);
    const db = createDb([{ ...detail, studentId: null, studentName: null, studentEmail: null }]);
    getDbMock.mockReturnValue(db);

    const result = await getAppointmentDetailHandler({ data: { appointmentId: 401 } });

    expect(result).toMatchObject({ appointment: { id: 401, studentId: null } });
  });

  it('sanitizes database failures', async () => {
    getDbMock.mockImplementation(() => {
      throw new Error('database detail');
    });

    const result = await getAppointmentDetailHandler({ data: { appointmentId: 401 } });

    expect(result).toEqual({ error: { code: 'INTERNAL', message: 'Internal Server Error' } });
  });
});
