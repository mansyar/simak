/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  listInstructorAssignmentsHandler,
  getAssignmentDetailHandler,
} from '@/server/assignments.server';
import * as auth from '@/server/auth';
import * as dbMod from '@/db/index';

vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn(),
}));

vi.mock('@/db/index', () => ({
  getDb: vi.fn(),
}));

const mockSession = {
  user: { id: 'instructor-1', role: 'instructor' as const },
  session: {} as any,
};

describe('Assignment handlers — boundary date serialization', () => {
  let mockDb: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {
      transaction: vi.fn(async (cb: any) => cb(mockDb)),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      then: vi.fn(function (onfulfilled: any) {
        return Promise.resolve([]).then(onfulfilled);
      }),
    };
    vi.mocked(dbMod.getDb).mockReturnValue(mockDb as any);
  });

  describe('listInstructorAssignmentsHandler', () => {
    it('returns ISO strings for finalDeadline and createdAt', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(mockSession as any);

      const finalDeadline = new Date('2026-12-31T00:00:00.000Z');
      const createdAt = new Date('2026-05-01T10:30:00.000Z');

      mockDb.then
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([
            {
              id: 42,
              title: 'Assignment 1',
              templateName: 'Tpl',
              templateType: 'Thesis',
              finalDeadline,
              createdAt,
            },
          ]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ assignmentId: 42, count: 5 }]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ count: 1 }]).then(onfulfilled),
        );

      const result = await listInstructorAssignmentsHandler({
        data: { page: 1, limit: 20, search: '' },
      });

      expect(result).not.toHaveProperty('error');
      const data = result as Exclude<typeof result, { error: unknown }>;

      expect(data.assignments[0].finalDeadline).toBe(finalDeadline.toISOString());
      expect(data.assignments[0].createdAt).toBe(createdAt.toISOString());
    });
  });

  describe('getAssignmentDetailHandler', () => {
    it('returns ISO strings for assignment and checkpoint due dates', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(mockSession as any);

      const finalDeadline = new Date('2026-12-31T00:00:00.000Z');
      const createdAt = new Date('2026-05-01T10:30:00.000Z');
      const dueDate1 = new Date('2026-06-01T00:00:00.000Z');
      const dueDate2 = new Date('2026-07-01T00:00:00.000Z');

      mockDb.then
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([
            {
              id: 42,
              title: 'Detailed Assignment',
              instructorId: 'instructor-1',
              templateName: 'Thesis Template',
              templateType: 'Thesis',
              finalDeadline,
              createdAt,
            },
          ]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ id: 'student-1', name: 'Alice', email: 'alice@test.com' }]).then(
            onfulfilled,
          ),
        )
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([
            {
              id: 101,
              studentId: 'student-1',
              name: 'Milestone 1',
              order: 1,
              state: 'passed',
              dueDate: dueDate1,
              minConsultations: 0,
            },
            {
              id: 102,
              studentId: 'student-1',
              name: 'Milestone 2',
              order: 2,
              state: 'unlocked',
              dueDate: dueDate2,
              minConsultations: 0,
            },
          ]).then(onfulfilled),
        );

      const result = await getAssignmentDetailHandler({ data: { id: 42 } });

      expect(result).not.toBeNull();
      expect(result).not.toHaveProperty('error');
      const data = result as Exclude<typeof result, null | { error: unknown }>;

      expect(data.finalDeadline).toBe(finalDeadline.toISOString());
      expect(data.createdAt).toBe(createdAt.toISOString());
      expect(data.students[0].checkpoints[0].dueDate).toBe(dueDate1.toISOString());
      expect(data.students[0].checkpoints[1].dueDate).toBe(dueDate2.toISOString());
      expect(data.students[0].effectiveDeadline).toBe(dueDate2.toISOString());
    });

    it('converts null dueDate to null string sentinel', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(mockSession as any);

      mockDb.then
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([
            {
              id: 42,
              title: 'Detailed Assignment',
              instructorId: 'instructor-1',
              templateName: 'Thesis Template',
              templateType: 'Thesis',
              finalDeadline: new Date('2026-12-31T00:00:00.000Z'),
              createdAt: new Date('2026-05-01T10:30:00.000Z'),
            },
          ]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ id: 'student-1', name: 'Alice', email: 'alice@test.com' }]).then(
            onfulfilled,
          ),
        )
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([
            {
              id: 101,
              studentId: 'student-1',
              name: 'Milestone 1',
              order: 1,
              state: 'passed',
              dueDate: null,
              minConsultations: 0,
            },
          ]).then(onfulfilled),
        );

      const result = await getAssignmentDetailHandler({ data: { id: 42 } });

      expect(result).not.toBeNull();
      const data = result as Exclude<typeof result, null | { error: unknown }>;

      expect(data.students[0].checkpoints[0].dueDate).toBeNull();
      expect(data.students[0].effectiveDeadline).toBeNull();
    });
  });

  describe('BUG-26: instructorId ownership check in SQL WHERE', () => {
    it('AC-16: no JS post-query instructorId !== session.user.id check remains', () => {
      const filePath = resolve(__dirname, '../../../src/server/assignments.server.ts');
      const content = readFileSync(filePath, 'utf8');
      expect(content).not.toContain('instructorId !== session.user.id');
    });

    it('AC-16: getAssignmentDetailHandler filters by instructorId in SQL WHERE', () => {
      const filePath = resolve(__dirname, '../../../src/server/assignments.server.ts');
      const content = readFileSync(filePath, 'utf8');
      // Before fix: only 1 occurrence (in listInstructorAssignmentsHandler)
      // After fix: 2+ occurrences (listInstructorAssignmentsHandler + getAssignmentDetailHandler)
      const matches = content.match(/eq\(assignments\.instructorId, session\.user\.id\)/g);
      expect(matches?.length).toBeGreaterThanOrEqual(2);
    });

    it('returns null when assignment does not belong to the instructor (zero rows)', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(mockSession as any);

      // Simulate WHERE clause filtering: DB returns empty rows for non-owner
      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([]).then(onfulfilled),
      );

      const result = await getAssignmentDetailHandler({ data: { id: 42 } });
      expect(result).toBeNull();
    });
  });
});
