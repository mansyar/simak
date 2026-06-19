/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAdminDashboardDataHandler } from '@/server/dashboard.server';
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
    handler: vi.fn().mockImplementation((fn) => fn),
  }),
}));
const adminSession = {
  user: { id: 'admin-1', role: 'admin' },
  session: {},
};
const studentSession = {
  user: { id: 'student-1', role: 'student' },
  session: {},
};
describe('getAdminDashboardDataHandler', () => {
  let mockDb;
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      then: vi.fn(function (onfulfilled) {
        return Promise.resolve([]).then(onfulfilled);
      }),
    };
    vi.mocked(dbMod.getDb).mockReturnValue(mockDb);
  });
  it('should reject if unauthorized (no session)', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);
    const result = await getAdminDashboardDataHandler();
    expect(result).toEqual({ error: 'Unauthorized' });
  });
  it('should reject if not an admin', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession);
    const result = await getAdminDashboardDataHandler();
    expect(result).toEqual({ error: 'Unauthorized' });
  });
  it('should return metrics when data exists', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession);
    mockDb.then
      .mockImplementationOnce((onfulfilled) =>
        Promise.resolve([{ total: 10, instructors: 2, students: 5 }]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled) =>
        Promise.resolve([{ activeAssignmentCount: 3 }]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled) =>
        Promise.resolve([{ pendingReviewCount: 7 }]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled) =>
        Promise.resolve([{ activeConsultationCount: 4 }]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled) => Promise.resolve([]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled) =>
        Promise.resolve([{ pending: 5, sent: 10, failed: 2 }]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled) => Promise.resolve([]).then(onfulfilled));
    const result = await getAdminDashboardDataHandler();
    expect(result).toHaveProperty('metrics');
    expect(result.metrics).toHaveProperty('totalUsers', 10);
    expect(result.metrics).toHaveProperty('instructors', 2);
    expect(result.metrics).toHaveProperty('students', 5);
    expect(result.metrics).toHaveProperty('activeAssignments', 3);
    expect(result.metrics).toHaveProperty('pendingReviews', 7);
    expect(result.metrics).toHaveProperty('activeConsultations', 4);
    expect(result).toHaveProperty('emailQueueCounts');
    expect(result.emailQueueCounts).toEqual({ pending: 5, sent: 10, failed: 2 });
  });
  it('should return recent activity when notifications exist', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession);
    mockDb.then
      .mockImplementationOnce((onfulfilled) =>
        Promise.resolve([{ total: 10, instructors: 2, students: 5 }]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled) =>
        Promise.resolve([{ activeAssignmentCount: 3 }]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled) =>
        Promise.resolve([{ pendingReviewCount: 7 }]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled) =>
        Promise.resolve([{ activeConsultationCount: 4 }]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled) =>
        Promise.resolve([
          {
            id: 1,
            type: 'sla_breach',
            title: 'SLA Breach',
            message: 'Overdue',
            createdAt: new Date(),
          },
          {
            id: 2,
            type: 'submission',
            title: 'New Submission',
            message: null,
            createdAt: new Date(),
          },
        ]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled) =>
        Promise.resolve([{ pending: 0, sent: 0, failed: 0 }]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled) => Promise.resolve([]).then(onfulfilled));
    const result = await getAdminDashboardDataHandler();
    expect(result.recentActivity).toHaveLength(2);
    expect(result.recentActivity[0].type).toBe('sla_breach');
    expect(result.recentActivity[0].title).toBe('SLA Breach');
    expect(result.recentActivity[0].message).toBe('Overdue');
  });
  it('should return escalation alerts when overdue submissions exist', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession);
    mockDb.then
      .mockImplementationOnce((onfulfilled) =>
        Promise.resolve([{ total: 10, instructors: 2, students: 5 }]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled) =>
        Promise.resolve([{ activeAssignmentCount: 3 }]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled) =>
        Promise.resolve([{ pendingReviewCount: 7 }]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled) =>
        Promise.resolve([{ activeConsultationCount: 4 }]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled) => Promise.resolve([]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled) =>
        Promise.resolve([{ pending: 1, sent: 5, failed: 0 }]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled) =>
        Promise.resolve([
          {
            submissionId: 10,
            instructorName: 'Dr. Smith',
            assignmentTitle: 'Thesis',
            checkpointName: 'Ch 1',
            studentName: 'Alice',
            daysOverdue: 5,
          },
          {
            submissionId: 11,
            instructorName: 'Dr. Jones',
            assignmentTitle: 'Research',
            checkpointName: 'Intro',
            studentName: 'Bob',
            daysOverdue: 3,
          },
        ]).then(onfulfilled),
      );
    const result = await getAdminDashboardDataHandler();
    expect(result.escalationAlerts).toHaveLength(2);
    expect(result.escalationAlerts[0].instructorName).toBe('Dr. Smith');
    expect(result.escalationAlerts[0].daysOverdue).toBe(5);
    expect(result.escalationAlerts[1].submissionId).toBe(11);
    expect(result.emailQueueCounts).toEqual({ pending: 1, sent: 5, failed: 0 });
  });
  it('should return email queue counts', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession);
    mockDb.then
      .mockImplementationOnce((onfulfilled) =>
        Promise.resolve([{ total: 10, instructors: 2, students: 5 }]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled) =>
        Promise.resolve([{ activeAssignmentCount: 3 }]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled) =>
        Promise.resolve([{ pendingReviewCount: 7 }]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled) =>
        Promise.resolve([{ activeConsultationCount: 4 }]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled) => Promise.resolve([]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled) =>
        Promise.resolve([{ pending: 12, sent: 45, failed: 3 }]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled) => Promise.resolve([]).then(onfulfilled));
    const result = await getAdminDashboardDataHandler();
    expect(result.emailQueueCounts).toEqual({ pending: 12, sent: 45, failed: 3 });
  });
});
