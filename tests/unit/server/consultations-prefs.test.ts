/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  logConsultationHandler,
  verifyConsultationHandler,
  rejectConsultationHandler,
} from '@/server/consultations.server';
import * as auth from '@/server/auth';
import * as dbMod from '@/db/index';

vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn(),
}));

vi.mock('@/db/index', () => ({
  getDb: vi.fn(),
}));

vi.mock('@tanstack/react-start', () => ({
  createServerFn: vi.fn().mockReturnValue({
    inputValidator: vi.fn().mockReturnThis(),
    handler: vi.fn().mockImplementation((fn) => fn),
  }),
}));

describe('Consultation server functions - notification preferences', () => {
  const mockDb: any = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    for: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    then: vi.fn(function (onfulfilled: any) {
      return Promise.resolve([]).then(onfulfilled);
    }),
  };

  mockDb.transaction = vi.fn().mockImplementation(async (callback: any) => callback(mockDb));

  const studentSession = {
    user: { id: 'student-1', role: 'student' } as any,
    session: {} as any,
  };

  const instructorSession = {
    user: { id: 'instructor-1', role: 'instructor' } as any,
    session: {} as any,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dbMod.getDb).mockReturnValue(mockDb as any);
  });

  describe('logConsultationHandler', () => {
    const logData = {
      checkpointId: 1,
      sessionType: 'internal' as const,
      notes: 'Discussed methodology',
    };

    it('should skip notification when inApp preference is false', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession);

      mockDb.then
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([
            {
              id: 1,
              assignmentId: 1,
              studentId: 'student-1',
              assignmentInstructorId: 'instructor-1',
            },
          ]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ id: 1 }]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([
            {
              settings: {
                notificationPrefs: { consultation_logged: { inApp: false } },
              },
            },
          ]).then(onfulfilled),
        );

      const result = await logConsultationHandler({ data: logData });
      expect(result).toHaveProperty('consultation');

      // Only the consultation INSERT, no notification INSERT
      expect(mockDb.insert).toHaveBeenCalledTimes(1);
      const valuesCalls = vi.mocked(mockDb.values).mock.calls.map((c: any[]) => c[0]);
      const notificationValues = valuesCalls.find((v: any) => v?.type === 'consultation_logged');
      expect(notificationValues).toBeUndefined();
    });
  });

  describe('verifyConsultationHandler', () => {
    it('should skip notification when inApp preference is false', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession);

      mockDb.then
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([
            {
              id: 1,
              status: 'pending',
              studentId: 'student-1',
              assignmentId: 1,
              instructorId: 'instructor-1',
            },
          ]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled))
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([
            {
              settings: {
                notificationPrefs: { consultation_verified: { inApp: false } },
              },
            },
          ]).then(onfulfilled),
        );

      const result = await verifyConsultationHandler({ data: { consultationId: 1 } });
      expect(result).toEqual({ success: true });

      // No notification INSERT — check values for notification type
      const valuesCalls = vi.mocked(mockDb.values).mock.calls.map((c: any[]) => c[0]);
      const notificationValues = valuesCalls.find((v: any) => v?.type === 'consultation_verified');
      expect(notificationValues).toBeUndefined();
    });
  });

  describe('rejectConsultationHandler', () => {
    it('should skip notification when inApp preference is false', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession);

      mockDb.then
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([
            {
              id: 1,
              status: 'pending',
              studentId: 'student-1',
              assignmentId: 1,
              instructorId: 'instructor-1',
            },
          ]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled))
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([
            {
              settings: {
                notificationPrefs: { consultation_rejected: { inApp: false } },
              },
            },
          ]).then(onfulfilled),
        );

      const result = await rejectConsultationHandler({
        data: { consultationId: 1, reason: 'Insufficient detail' },
      });
      expect(result).toEqual({ success: true });

      // No notification INSERT — check values for notification type
      const valuesCalls = vi.mocked(mockDb.values).mock.calls.map((c: any[]) => c[0]);
      const notificationValues = valuesCalls.find((v: any) => v?.type === 'consultation_rejected');
      expect(notificationValues).toBeUndefined();
    });
  });
});
