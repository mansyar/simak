/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '@/db';
import { getSessionFromHeaders } from '@/server/auth';
import { listInstructorAssignmentSectionsHandler } from '@/server/instructor-assignment-context.server';

vi.mock('@/db', () => ({
  getDb: vi.fn(),
}));

vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn(),
}));

describe('listInstructorAssignmentSectionsHandler', () => {
  const instructorSession = {
    user: {
      id: 'instructor-1',
      name: 'Instructor One',
      email: 'instructor@example.com',
      role: 'instructor' as const,
      locale: 'en',
      emailVerified: true,
    },
    session: {} as never,
  };

  let results: unknown[];
  let mockDb: {
    select: ReturnType<typeof vi.fn>;
    from: ReturnType<typeof vi.fn>;
    innerJoin: ReturnType<typeof vi.fn>;
    where: ReturnType<typeof vi.fn>;
    orderBy: ReturnType<typeof vi.fn>;
    then: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    results = [];
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      then: vi.fn(
        (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
          Promise.resolve(results.shift() ?? []).then(onFulfilled, onRejected),
      ),
    };
    vi.mocked(getDb).mockReturnValue(mockDb as never);
  });

  it('rejects unauthenticated and non-instructor requests before querying', async () => {
    vi.mocked(getSessionFromHeaders).mockResolvedValueOnce(null);
    await expect(listInstructorAssignmentSectionsHandler()).resolves.toEqual({
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
    });

    vi.mocked(getSessionFromHeaders).mockResolvedValueOnce({
      ...instructorSession,
      user: { ...instructorSession.user, role: 'student' },
    });
    await expect(listInstructorAssignmentSectionsHandler()).resolves.toEqual({
      error: { code: 'FORBIDDEN', message: 'Instructor access required' },
    });
    expect(getDb).not.toHaveBeenCalled();
  });

  it('returns authorized sections with only active enrolled students', async () => {
    vi.mocked(getSessionFromHeaders).mockResolvedValue(instructorSession);
    results.push([
      {
        id: 7,
        code: 'A',
        name: 'Section A',
        status: 'active',
        termId: 1,
        termName: 'Fall 2026',
        courseId: 2,
        courseCode: 'CS101',
      },
    ]);
    results.push([{ id: 'student-1', name: 'Ada Lovelace', email: 'ada@example.com' }]);

    await expect(listInstructorAssignmentSectionsHandler()).resolves.toEqual({
      sections: [
        {
          id: 7,
          label: 'CS101 · A · Fall 2026',
          termId: 1,
          courseId: 2,
          status: 'active',
          students: [{ id: 'student-1', name: 'Ada Lovelace', email: 'ada@example.com' }],
        },
      ],
    });
    expect(mockDb.innerJoin).toHaveBeenCalled();
  });

  it('returns an internal error when the section query fails', async () => {
    vi.mocked(getSessionFromHeaders).mockResolvedValue(instructorSession);
    results.push(Promise.reject(new Error('database unavailable')));

    await expect(listInstructorAssignmentSectionsHandler()).resolves.toEqual({
      error: { code: 'INTERNAL', message: 'Unable to load course sections' },
    });
  });
});
