/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getStudentDashboardDataHandler } from '@/server/dashboard-student.server';
import * as auth from '@/server/auth';
import * as dbMod from '@/db/index';

vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn(),
}));

vi.mock('@/db/index', () => ({
  getDb: vi.fn(),
}));

const studentSession = {
  user: { id: 'student-1', role: 'student' as const },
  session: {} as any,
};

describe('getStudentDashboardDataHandler — BUG-19 deadline fixes', () => {
  let mockDb: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      then: vi.fn(function (onfulfilled: any) {
        return Promise.resolve([]).then(onfulfilled);
      }),
    };
    vi.mocked(dbMod.getDb).mockReturnValue(mockDb as any);
  });

  // BUG-19 FR-6.1: passed checkpoints must be excluded from upcomingDeadlines
  it('should exclude passed checkpoints from upcomingDeadlines', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);
    mockDb.then
      // activeAssignments query → return 1 assignment
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([
          {
            id: 1,
            title: 'Thesis',
            finalDeadline: new Date('2026-07-01'),
            templateName: 'Thesis Template',
            templateType: 'Thesis',
          },
        ]).then(onfulfilled),
      )
      // upcomingDeadlines query → return 4 checkpoints (2 passed, 2 non-passed)
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([
          {
            assignmentId: 1,
            assignmentTitle: 'Thesis',
            checkpointName: 'Ch 1',
            dueDate: new Date('2026-06-15'),
            state: 'unlocked',
          },
          {
            assignmentId: 1,
            assignmentTitle: 'Thesis',
            checkpointName: 'Ch 2',
            dueDate: new Date('2026-05-01'),
            state: 'passed',
          },
          {
            assignmentId: 1,
            assignmentTitle: 'Thesis',
            checkpointName: 'Ch 3',
            dueDate: new Date('2026-07-15'),
            state: 'locked',
          },
          {
            assignmentId: 1,
            assignmentTitle: 'Thesis',
            checkpointName: 'Ch 4',
            dueDate: new Date('2026-04-01'),
            state: 'passed',
          },
        ]).then(onfulfilled),
      )
      // pendingReviews query → empty
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled))
      // consultationReminders query → empty
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled))
      // allCheckpoints query → return 3 checkpoints
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([
          {
            assignmentId: 1,
            name: 'Ch 1',
            order: 1,
            state: 'unlocked',
            dueDate: new Date('2026-06-15'),
          },
          {
            assignmentId: 1,
            name: 'Ch 2',
            order: 2,
            state: 'passed',
            dueDate: new Date('2026-05-01'),
          },
          {
            assignmentId: 1,
            name: 'Ch 3',
            order: 3,
            state: 'locked',
            dueDate: new Date('2026-07-15'),
          },
        ]).then(onfulfilled),
      );

    const result = (await getStudentDashboardDataHandler()) as any;
    // Only non-passed checkpoints should appear (Ch 1 unlocked + Ch 3 locked = 2)
    expect(result.upcomingDeadlines).toHaveLength(2);
    expect(result.upcomingDeadlines[0].checkpointName).toBe('Ch 1');
    expect(result.upcomingDeadlines[1].checkpointName).toBe('Ch 3');
  });

  // BUG-19 FR-6.2: null dueDate should NOT be treated as overdue
  it('should handle null dueDate as not overdue with null daysRemaining', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);
    mockDb.then
      // activeAssignments query → return 1 assignment
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([
          {
            id: 1,
            title: 'Thesis',
            finalDeadline: new Date('2026-07-01'),
            templateName: 'Thesis Template',
            templateType: 'Thesis',
          },
        ]).then(onfulfilled),
      )
      // upcomingDeadlines query → return 2 checkpoints: 1 null dueDate, 1 valid
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([
          {
            assignmentId: 1,
            assignmentTitle: 'Thesis',
            checkpointName: 'No Date Chk',
            dueDate: null,
            state: 'unlocked',
          },
          {
            assignmentId: 1,
            assignmentTitle: 'Thesis',
            checkpointName: 'Future Chk',
            dueDate: new Date('2026-12-31'),
            state: 'unlocked',
          },
        ]).then(onfulfilled),
      )
      // pendingReviews query → empty
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled))
      // consultationReminders query → empty
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled))
      // allCheckpoints query
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([
          { assignmentId: 1, name: 'No Date Chk', order: 1, state: 'unlocked', dueDate: null },
          {
            assignmentId: 1,
            name: 'Future Chk',
            order: 2,
            state: 'unlocked',
            dueDate: new Date('2026-12-31'),
          },
        ]).then(onfulfilled),
      );

    const result = (await getStudentDashboardDataHandler()) as any;
    expect(result.upcomingDeadlines).toHaveLength(2);

    // The null-dueDate checkpoint should NOT be overdue and should have null daysRemaining
    const nullDeadline = result.upcomingDeadlines.find(
      (d: any) => d.checkpointName === 'No Date Chk',
    );
    expect(nullDeadline).toBeDefined();
    expect(nullDeadline.isOverdue).toBe(false);
    expect(nullDeadline.daysRemaining).toBeNull();
    expect(nullDeadline.dueDate).toBeNull();

    // The valid-dueDate checkpoint should have a number for daysRemaining
    const validDeadline = result.upcomingDeadlines.find(
      (d: any) => d.checkpointName === 'Future Chk',
    );
    expect(validDeadline).toBeDefined();
    expect(validDeadline.isOverdue).toBe(false);
    expect(typeof validDeadline.daysRemaining).toBe('number');
  });
});
