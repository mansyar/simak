/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listPendingConsultationsHandler } from '@/server/consultations.server';
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

const instructorSession = {
  user: { id: 'instructor-1', role: 'instructor' } as any,
  session: {} as any,
};

describe('listPendingConsultationsHandler — boundary date serialization', () => {
  const mockDb: any = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
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

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dbMod.getDb).mockReturnValue(mockDb as any);
  });

  it('returns ISO strings for consultation createdAt', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession);

    const createdAt = new Date('2026-05-01T10:30:00.000Z');

    mockDb.then
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([{ id: 1 }]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([
          {
            id: 1,
            checkpointId: 1,
            studentId: 'student-1',
            sessionType: 'internal',
            externalConsultantName: null,
            notes: null,
            createdAt,
            studentName: 'Student A',
            checkpointName: 'Ch 1',
          },
        ]).then(onfulfilled),
      );

    const result = await listPendingConsultationsHandler({ data: { assignmentId: 1 } });

    expect(result).not.toHaveProperty('error');
    const data = result as Exclude<typeof result, { error: unknown }>;

    expect(data.consultations[0].createdAt).toBe(createdAt.toISOString());
  });
});
