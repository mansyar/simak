/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getSessionFromHeaders } from '@/server/auth';
import { getDb } from '@/db/index';
import { safeAuditLog } from '@/lib/audit';
import {
  createAppointmentSlotHandler,
  listInstructorAppointmentsHandler,
} from '@/server/appointments.server';

vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn(),
}));

vi.mock('@/db/index', () => ({
  getDb: vi.fn(),
}));

vi.mock('@/lib/audit', () => ({
  safeAuditLog: vi.fn(),
}));

const instructorSession = {
  user: { id: 'instructor-1', role: 'instructor' as const },
  session: {},
};

const studentSession = {
  user: { id: 'student-1', role: 'student' as const },
  session: {},
};

const futureStart = new Date(Date.now() + 60 * 60_000);
const futureEnd = new Date(futureStart.getTime() + 30 * 60_000);

function createMockDb() {
  const mockDb = {
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
    then: vi.fn(),
  };

  return mockDb;
}

function queueResults(mockDb: ReturnType<typeof createMockDb>, results: unknown[]) {
  mockDb.then.mockImplementation((onFulfilled: (value: unknown) => unknown) =>
    Promise.resolve(results.shift() ?? []).then(onFulfilled),
  );
}

describe('Appointment instructor handlers', () => {
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    vi.mocked(getDb).mockReturnValue(mockDb as never);
    vi.mocked(getSessionFromHeaders).mockResolvedValue(instructorSession as never);
  });

  describe('createAppointmentSlotHandler', () => {
    const validData = {
      assignmentId: 10,
      checkpointId: 4,
      startAt: futureStart,
      endAt: futureEnd,
    };

    it('creates an available slot for an authorized active assignment and checkpoint', async () => {
      const appointment = {
        id: 101,
        assignmentId: 10,
        checkpointId: 4,
        instructorId: 'instructor-1',
        studentId: null,
        startAt: futureStart,
        endAt: futureEnd,
        status: 'available' as const,
        createdAt: futureStart,
        updatedAt: futureStart,
      };
      queueResults(mockDb, [[{ id: 10, sectionId: 2 }], [{ id: 4 }], [appointment]]);

      const result = await createAppointmentSlotHandler({ data: validData });

      expect(result).toEqual({
        appointment: { ...appointment, studentName: null, studentEmail: null },
      });
      expect(mockDb.insert).toHaveBeenCalledTimes(1);
      expect(mockDb.values).toHaveBeenCalledWith({
        assignmentId: 10,
        checkpointId: 4,
        instructorId: 'instructor-1',
        startAt: futureStart,
        endAt: futureEnd,
        status: 'available',
      });
      expect(mockDb.innerJoin).toHaveBeenCalledTimes(4);
      expect(safeAuditLog).toHaveBeenCalledWith(
        'appointment.created',
        expect.objectContaining({
          actorId: 'instructor-1',
          action: 'appointment.created',
          entityType: 'appointment',
          entityId: '101',
        }),
      );
    });

    it('allows an assignment-scoped slot without a checkpoint', async () => {
      const appointment = {
        id: 102,
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
      queueResults(mockDb, [[{ id: 10, sectionId: 2 }], [appointment]]);

      const result = await createAppointmentSlotHandler({
        data: { assignmentId: 10, startAt: futureStart, endAt: futureEnd },
      });

      expect(result).toHaveProperty('appointment.id', 102);
      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({ assignmentId: 10, checkpointId: undefined }),
      );
    });

    it('rejects a past window before querying the database', async () => {
      const result = await createAppointmentSlotHandler({
        data: {
          assignmentId: 10,
          startAt: new Date(Date.now() - 60_000),
          endAt: new Date(Date.now() + 30 * 60_000),
        },
      });

      expect(result).toEqual({
        error: { code: 'BAD_REQUEST', message: 'Appointment window is invalid' },
      });
      expect(getDb).not.toHaveBeenCalled();
    });

    it('rejects a duration outside the policy range before querying the database', async () => {
      const result = await createAppointmentSlotHandler({
        data: {
          assignmentId: 10,
          startAt: futureStart,
          endAt: new Date(futureStart.getTime() + 121 * 60_000),
        },
      });

      expect(result).toEqual({
        error: { code: 'BAD_REQUEST', message: 'Appointment window is invalid' },
      });
      expect(getDb).not.toHaveBeenCalled();
    });

    it.each([
      [null, 'unauthenticated'],
      [studentSession, 'student'],
      [{ ...instructorSession, user: { ...instructorSession.user, role: 'admin' } }, 'admin'],
    ])('rejects %s access to slot creation', async (session, _label) => {
      vi.mocked(getSessionFromHeaders).mockResolvedValue(session as never);

      const result = await createAppointmentSlotHandler({ data: validData });

      expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      expect(getDb).not.toHaveBeenCalled();
    });

    it.each([
      ['unrelated assignment', instructorSession],
      [
        'inactive instructor',
        { ...instructorSession, user: { ...instructorSession.user, deletedAt: new Date() } },
      ],
      ['inactive assignment', instructorSession],
    ])('hides %s access', async (_label, session) => {
      vi.mocked(getSessionFromHeaders).mockResolvedValue(session as never);
      queueResults(mockDb, []);

      const result = await createAppointmentSlotHandler({ data: validData });

      expect(result).toEqual({ error: { code: 'NOT_FOUND', message: 'Assignment not found' } });
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('rejects a checkpoint that is not part of the authorized assignment', async () => {
      queueResults(mockDb, [[{ id: 10, sectionId: 2 }], []]);

      const result = await createAppointmentSlotHandler({ data: validData });

      expect(result).toEqual({ error: { code: 'NOT_FOUND', message: 'Checkpoint not found' } });
      expect(mockDb.insert).not.toHaveBeenCalled();
    });
  });

  describe('listInstructorAppointmentsHandler', () => {
    it('returns explicitly selected rows in bounded start/id order', async () => {
      const rows = [
        {
          id: 11,
          assignmentId: 10,
          checkpointId: null,
          instructorId: 'instructor-1',
          studentId: null,
          studentName: null,
          studentEmail: null,
          startAt: futureStart,
          endAt: futureEnd,
          status: 'available' as const,
          createdAt: futureStart,
          updatedAt: futureStart,
        },
      ];
      queueResults(mockDb, [[{ id: 10, sectionId: 2 }], rows, [{ count: 1 }]]);

      const result = await listInstructorAppointmentsHandler({
        data: { assignmentId: 10, status: 'available', page: 2, limit: 2 },
      });

      expect(result).toEqual({ appointments: rows, total: 1 });
      expect(mockDb.orderBy).toHaveBeenCalledTimes(1);
      expect(mockDb.limit).toHaveBeenLastCalledWith(2);
      expect(mockDb.offset).toHaveBeenCalledWith(2);
      expect(mockDb.leftJoin).toHaveBeenCalledTimes(1);
    });

    it('rejects non-instructors and does not query appointment data', async () => {
      vi.mocked(getSessionFromHeaders).mockResolvedValue(studentSession as never);

      const result = await listInstructorAppointmentsHandler({
        data: { assignmentId: 10, page: 1, limit: 20 },
      });

      expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      expect(getDb).not.toHaveBeenCalled();
    });

    it('does not enumerate an assignment the instructor cannot access', async () => {
      queueResults(mockDb, []);

      const result = await listInstructorAppointmentsHandler({
        data: { assignmentId: 99, page: 1, limit: 20 },
      });

      expect(result).toEqual({ error: { code: 'NOT_FOUND', message: 'Assignment not found' } });
      expect(mockDb.leftJoin).not.toHaveBeenCalled();
    });
  });
});
