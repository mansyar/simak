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
    middleware: vi.fn().mockReturnThis(),
    inputValidator: vi.fn().mockReturnThis(),
    handler: vi.fn().mockImplementation((fn) => fn),
  }),
  createMiddleware: vi.fn().mockReturnValue({
    server: vi.fn().mockImplementation((fn) => fn),
  }),
}));

const adminSession = {
  user: { id: 'admin-1', role: 'admin' as const },
  session: {} as any,
};

const studentSession = {
  user: { id: 'student-1', role: 'student' as const },
  session: {} as any,
};

describe('getAdminDashboardDataHandler', () => {
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

  it('should reject if unauthorized (no session)', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);
    const result = await getAdminDashboardDataHandler();
    expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
  });

  it('should reject if not an admin', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);
    const result = await getAdminDashboardDataHandler();
    expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
  });

  it('should return metrics when data exists', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession as any);
    mockDb.then
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ total: 10, instructors: 2, students: 5 }]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ activeAssignmentCount: 3 }]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ pendingReviewCount: 7 }]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ activeConsultationCount: 4 }]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ pending: 5, sent: 10, failed: 2 }]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled));

    const result = await getAdminDashboardDataHandler();
    expect(result).toHaveProperty('metrics');
    expect((result as any).metrics).toHaveProperty('totalUsers', 10);
    expect((result as any).metrics).toHaveProperty('instructors', 2);
    expect((result as any).metrics).toHaveProperty('students', 5);
    expect((result as any).metrics).toHaveProperty('activeAssignments', 3);
    expect((result as any).metrics).toHaveProperty('pendingReviews', 7);
    expect((result as any).metrics).toHaveProperty('activeConsultations', 4);
    expect(result).toHaveProperty('emailQueueCounts');
    expect((result as any).emailQueueCounts).toEqual({ pending: 5, sent: 10, failed: 2 });
  });

  it('should return recent activity when notifications exist', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession as any);
    mockDb.then
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ total: 10, instructors: 2, students: 5 }]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ activeAssignmentCount: 3 }]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ pendingReviewCount: 7 }]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ activeConsultationCount: 4 }]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([
          {
            id: 1,
            type: 'sla_breach',
            titleKey: 'SLA Breach',
            messageKey: 'Overdue',
            params: null,
            createdAt: new Date(),
          },
          {
            id: 2,
            type: 'submission',
            titleKey: 'New Submission',
            messageKey: null,
            params: null,
            createdAt: new Date(),
          },
        ]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ pending: 0, sent: 0, failed: 0 }]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled));

    const result = (await getAdminDashboardDataHandler()) as any;
    expect(result.recentActivity).toHaveLength(2);
    expect(result.recentActivity[0].type).toBe('sla_breach');
    expect(result.recentActivity[0].title).toBe('SLA Breach');
    expect(result.recentActivity[0].message).toBe('Overdue');
  });

  it('should return escalation alerts when overdue submissions exist', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession as any);
    mockDb.then
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ total: 10, instructors: 2, students: 5 }]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ activeAssignmentCount: 3 }]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ pendingReviewCount: 7 }]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ activeConsultationCount: 4 }]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ pending: 1, sent: 5, failed: 0 }]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled: any) =>
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

    const result = (await getAdminDashboardDataHandler()) as any;
    expect(result.escalationAlerts).toHaveLength(2);
    expect(result.escalationAlerts[0].instructorName).toBe('Dr. Smith');
    expect(result.escalationAlerts[0].daysOverdue).toBe(5);
    expect(result.escalationAlerts[1].submissionId).toBe(11);
    expect(result.emailQueueCounts).toEqual({ pending: 1, sent: 5, failed: 0 });
  });

  it('should return email queue counts', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession as any);
    mockDb.then
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ total: 10, instructors: 2, students: 5 }]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ activeAssignmentCount: 3 }]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ pendingReviewCount: 7 }]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ activeConsultationCount: 4 }]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ pending: 12, sent: 45, failed: 3 }]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled));

    const result = (await getAdminDashboardDataHandler()) as any;
    expect(result.emailQueueCounts).toEqual({ pending: 12, sent: 45, failed: 3 });
  });

  // BUG-11: daysOverdue SQL must use EXTRACT(EPOCH FROM ...) / 86400, not extract(day from ...)
  // extract(day from interval) returns the day-component (wraps at ~30), not total elapsed days.
  describe('BUG-11: daysOverdue SQL arithmetic', () => {
    /**
     * Recursively extracts raw SQL text from a Drizzle SQL object by collecting
     * StringChunk values from queryChunks, recursing into nested SQL objects.
     */
    function extractSqlText(sqlObj: any): string {
      if (!sqlObj || !sqlObj.queryChunks) return '';
      return sqlObj.queryChunks
        .map((chunk: any) => {
          if (chunk?.constructor?.name === 'StringChunk' && Array.isArray(chunk.value)) {
            return chunk.value.join('');
          }
          // Recurse into nested SQL objects (e.g. inside desc() wrapper)
          if (chunk?.queryChunks) {
            return extractSqlText(chunk);
          }
          return '';
        })
        .join('');
    }

    it('daysOverdue SELECT should use EXTRACT(EPOCH FROM ...) / 86400 (not extract(day from ...))', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession as any);
      mockDb.then.mockImplementation((onfulfilled: any) => Promise.resolve([]).then(onfulfilled));

      await getAdminDashboardDataHandler();

      // The 7th select() call (index 6) is the escalationAlerts query
      const escalationSelectCall = mockDb.select.mock.calls[6];
      expect(escalationSelectCall).toBeDefined();

      const selectFields = escalationSelectCall[0];
      const daysOverdueSql = selectFields.daysOverdue;
      const sqlText = extractSqlText(daysOverdueSql);

      // Should use EPOCH-based extraction for total elapsed days
      expect(sqlText).toContain('EPOCH');
      expect(sqlText).toContain('86400');
      // Should NOT use extract(day from ...) which wraps at ~30 days
      expect(sqlText.toLowerCase()).not.toContain('extract(day from');
    });

    it('escalationAlerts ORDER BY should use EXTRACT(EPOCH FROM ...) / 86400 (not extract(day from ...))', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession as any);
      mockDb.then.mockImplementation((onfulfilled: any) => Promise.resolve([]).then(onfulfilled));

      await getAdminDashboardDataHandler();

      // The escalationAlerts query's orderBy is the last orderBy call
      const orderByCalls = mockDb.orderBy.mock.calls;
      const lastOrderByCall = orderByCalls[orderByCalls.length - 1];
      expect(lastOrderByCall).toBeDefined();

      // desc(sql`...`) wraps the inner SQL in a SQL object; extractSqlText recurses into it
      const descWrapper = lastOrderByCall[0];
      const sqlText = extractSqlText(descWrapper);

      expect(sqlText).toContain('EPOCH');
      expect(sqlText).toContain('86400');
      expect(sqlText.toLowerCase()).not.toContain('extract(day from');
    });
  });
});
