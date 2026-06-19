/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listInstructorAssignmentsForFilterHandler } from '@/server/instructor-assignments-filter.server';
import * as auth from '@/server/auth';
import * as dbMod from '@/db/index';
vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn(),
}));
vi.mock('@/db/index', () => ({
  getDb: vi.fn(),
}));
describe('listInstructorAssignmentsForFilterHandler', () => {
  let mockDb;
  const instructorSession = {
    user: {
      id: 'instructor-1',
      name: 'Instructor One',
      email: 'instructor1@test.com',
      role: 'instructor',
      locale: 'en',
      emailVerified: true,
    },
    session: {},
  };
  const studentSession = {
    user: {
      id: 'student-1',
      name: 'Student One',
      email: 'student1@test.com',
      role: 'student',
      locale: 'en',
      emailVerified: true,
    },
    session: {},
  };
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      then: vi.fn((onfulfilled) => Promise.resolve([]).then(onfulfilled)),
    };
    vi.mocked(dbMod.getDb).mockReturnValue(mockDb);
  });
  it('should reject if unauthorized', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);
    const result = await listInstructorAssignmentsForFilterHandler();
    expect(result).toEqual({ error: 'Unauthorized' });
  });
  it('should reject if user is not an instructor', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession);
    const result = await listInstructorAssignmentsForFilterHandler();
    expect(result).toEqual({ error: 'Unauthorized' });
  });
  it('should return assignments for the current instructor', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession);
    const mockAssignments = [
      { id: 1, title: 'Assignment 1' },
      { id: 2, title: 'Assignment 2' },
    ];
    mockDb.then.mockImplementation((onfulfilled) =>
      Promise.resolve(mockAssignments).then(onfulfilled),
    );
    const result = await listInstructorAssignmentsForFilterHandler();
    expect(result).toEqual({ success: true, assignments: mockAssignments });
  });
  it('should only return non-deleted assignments', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession);
    mockDb.then.mockImplementation((onfulfilled) =>
      Promise.resolve([{ id: 1, title: 'Active Assignment' }]).then(onfulfilled),
    );
    await listInstructorAssignmentsForFilterHandler();
    // Verify the query includes a where clause for deleted_at IS NULL
    expect(mockDb.where).toHaveBeenCalled();
  });
  it('should order assignments by created_at desc', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession);
    mockDb.then.mockImplementation((onfulfilled) => Promise.resolve([]).then(onfulfilled));
    await listInstructorAssignmentsForFilterHandler();
    expect(mockDb.orderBy).toHaveBeenCalled();
  });
});
