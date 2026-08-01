/** @vitest-environment node */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { getInstructorDashboardDataHandler } from '@/server/dashboard-instructor.server';
import * as auth from '@/server/auth';
import * as dbMod from '@/db/index';

vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn(),
}));

vi.mock('@/db/index', () => ({
  getDb: vi.fn(),
}));

const instructorSession = {
  user: { id: 'instructor-1', role: 'instructor' as const },
  session: {} as any,
};

describe('instructor dashboard interventions', () => {
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
      groupBy: vi.fn().mockReturnThis(),
      then: vi.fn(function (onfulfilled: any) {
        return Promise.resolve([]).then(onfulfilled);
      }),
    };
    vi.mocked(dbMod.getDb).mockReturnValue(mockDb as any);
  });

  it('summarizes active and overdue interventions for at-risk students', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
    const now = new Date();
    const overdueDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    mockDb.then
      // Group A: assignments, recent submissions, assignment overview
      .mockImplementationOnce((fn: any) => Promise.resolve([{ id: 1 }]).then(fn))
      .mockImplementationOnce((fn: any) => Promise.resolve([]).then(fn))
      .mockImplementationOnce((fn: any) =>
        Promise.resolve([{ id: 1, title: 'Thesis', finalDeadline: null, createdAt: now }]).then(fn),
      )
      // Group B: pending review count and items
      .mockImplementationOnce((fn: any) => Promise.resolve([{ count: 0 }]).then(fn))
      .mockImplementationOnce((fn: any) => Promise.resolve([]).then(fn))
      // Group C: student, pending, and progress counts
      .mockImplementationOnce((fn: any) =>
        Promise.resolve([{ assignmentId: 1, count: 1 }]).then(fn),
      )
      .mockImplementationOnce((fn: any) => Promise.resolve([]).then(fn))
      .mockImplementationOnce((fn: any) =>
        Promise.resolve([{ assignmentId: 1, totalCount: 1, passedCount: 0 }]).then(fn),
      )
      // Live risk context: overdue checkpoint, consultation, submissions, revise reviews
      .mockImplementationOnce((fn: any) =>
        Promise.resolve([
          {
            checkpointId: 10,
            checkpointState: 'unlocked',
            dueDate: overdueDate,
            minConsultations: 1,
            studentId: 'student-1',
            studentName: 'Alice',
            assignmentId: 1,
            assignmentTitle: 'Thesis',
          },
        ]).then(fn),
      )
      .mockImplementationOnce((fn: any) => Promise.resolve([]).then(fn))
      .mockImplementationOnce((fn: any) => Promise.resolve([]).then(fn))
      .mockImplementationOnce((fn: any) => Promise.resolve([]).then(fn))
      // Active intervention
      .mockImplementationOnce((fn: any) =>
        Promise.resolve([
          {
            id: 55,
            studentId: 'student-1',
            assignmentId: 1,
            status: 'monitoring',
            followUpDate: overdueDate,
          },
        ]).then(fn),
      );

    const result = (await getInstructorDashboardDataHandler()) as any;
    expect(result.openInterventionCount).toBe(1);
    expect(result.overdueInterventionCount).toBe(1);
    expect(result.atRiskStudents[0].activeIntervention).toMatchObject({
      id: 55,
      status: 'monitoring',
      isOverdue: true,
    });
  });
});
