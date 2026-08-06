/** @vitest-environment node */
import { and, eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '@/db/index';
import {
  assignmentStudents,
  assignments,
  assignmentTemplates,
  auditLog,
  checkpoints,
  templateCheckpoints,
  users,
} from '@/db/schema';
import * as assignmentHandlers from '@/server/assignments.server';
import {
  createAssignmentHandler,
  getAssignmentDetailHandler,
  listStudentAssignmentsHandler,
  unlockCheckpointHandler,
} from '@/server/assignments.server';
import * as auth from '@/server/auth';
import {
  createAcademicSectionFixture,
  deleteAcademicSectionFixture,
  type AcademicSectionFixture,
} from '../helpers/academic-context';

vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn(),
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

describe('assignment academic-context integration', () => {
  const db = getDb();
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const instructorId = `assignment-context-instructor-${runId}`;
  const otherInstructorId = `assignment-context-other-${runId}`;
  const studentId = `assignment-context-student-${runId}`;
  const unassignedStudentId = `assignment-context-unassigned-${runId}`;
  let templateId: number;
  let academicFixture: AcademicSectionFixture;
  let otherAcademicFixture: AcademicSectionFixture;

  beforeEach(async () => {
    await db.insert(users).values([
      {
        id: instructorId,
        name: 'Context Instructor',
        email: `${instructorId}@test.com`,
        role: 'instructor',
      },
      {
        id: otherInstructorId,
        name: 'Other Context Instructor',
        email: `${otherInstructorId}@test.com`,
        role: 'instructor',
      },
      {
        id: studentId,
        name: 'Context Student',
        email: `${studentId}@test.com`,
        role: 'student',
      },
      {
        id: unassignedStudentId,
        name: 'Unassigned Student',
        email: `${unassignedStudentId}@test.com`,
        role: 'student',
      },
    ]);

    academicFixture = await createAcademicSectionFixture(db, `${runId}-primary`, instructorId, [
      studentId,
    ]);
    otherAcademicFixture = await createAcademicSectionFixture(
      db,
      `${runId}-other`,
      otherInstructorId,
      [unassignedStudentId],
    );

    const [template] = await db
      .insert(assignmentTemplates)
      .values({
        name: `Context Template ${runId}`,
        type: 'Thesis',
        createdBy: instructorId,
      })
      .returning({ id: assignmentTemplates.id });
    templateId = template.id;
    await db.insert(templateCheckpoints).values({
      templateId,
      name: 'Context Checkpoint',
      order: 1,
      estimatedDuration: 14,
    });
  });

  afterEach(async () => {
    const assignmentRows = await db
      .select({ id: assignments.id })
      .from(assignments)
      .where(eq(assignments.templateId, templateId));
    for (const assignment of assignmentRows) {
      await db.delete(checkpoints).where(eq(checkpoints.assignmentId, assignment.id));
      await db.delete(assignmentStudents).where(eq(assignmentStudents.assignmentId, assignment.id));
    }
    await db.delete(assignments).where(eq(assignments.templateId, templateId));
    await db.delete(templateCheckpoints).where(eq(templateCheckpoints.templateId, templateId));
    await db.delete(assignmentTemplates).where(eq(assignmentTemplates.id, templateId));
    await deleteAcademicSectionFixture(db, academicFixture);
    await deleteAcademicSectionFixture(db, otherAcademicFixture);
    await db.delete(auditLog).where(eq(auditLog.actorId, instructorId));
    await db.delete(auditLog).where(eq(auditLog.actorId, otherInstructorId));
    await db.delete(users).where(and(eq(users.id, instructorId)));
    await db.delete(users).where(eq(users.id, otherInstructorId));
    await db.delete(users).where(eq(users.id, studentId));
    await db.delete(users).where(eq(users.id, unassignedStudentId));
  });

  it('associates a new individual assignment with one section and starts it as draft', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
      user: { id: instructorId, role: 'instructor' },
      session: {} as any,
    } as any);

    const result = await createAssignmentHandler({
      data: {
        templateId,
        sectionId: academicFixture.sectionId,
        title: 'Section Assignment',
        description: 'Assignment context integration test',
        finalDeadline: new Date(Date.now() + 5_000_000),
        studentIds: [studentId],
      } as any,
    });

    expect(result).toMatchObject({ success: true });
    const assignmentId = (result as { assignmentId: number }).assignmentId;
    const [assignment] = await db
      .select({
        sectionId: assignments.sectionId,
        mode: assignments.mode,
        status: assignments.status,
      })
      .from(assignments)
      .where(eq(assignments.id, assignmentId));
    expect(assignment).toEqual({
      sectionId: academicFixture.sectionId,
      mode: 'individual',
      status: 'draft',
    });
  });

  it('rejects students who are not active members of the selected section', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
      user: { id: instructorId, role: 'instructor' },
      session: {} as any,
    } as any);

    const result = await createAssignmentHandler({
      data: {
        templateId,
        sectionId: academicFixture.sectionId,
        title: 'Invalid Student Assignment',
        finalDeadline: new Date(Date.now() + 5_000_000),
        studentIds: [studentId, unassignedStudentId],
      } as any,
    });

    expect(result).toMatchObject({ error: { code: 'BAD_REQUEST' } });
    const rows = await db
      .select({ id: assignments.id })
      .from(assignments)
      .where(eq(assignments.templateId, templateId));
    expect(rows).toHaveLength(0);
  });

  it('rejects an instructor who is not enrolled in the selected section', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
      user: { id: instructorId, role: 'instructor' },
      session: {} as any,
    } as any);

    const result = await createAssignmentHandler({
      data: {
        templateId,
        sectionId: otherAcademicFixture.sectionId,
        title: 'Unauthorized Section Assignment',
        finalDeadline: new Date(Date.now() + 5_000_000),
        studentIds: [unassignedStudentId],
      } as any,
    });

    expect(result).toMatchObject({ error: { code: 'FORBIDDEN' } });
  });

  it('hides draft assignments from student lists and protects cross-section details', async () => {
    const [draftAssignment] = await db
      .insert(assignments)
      .values({
        templateId,
        title: 'Draft Assignment',
        finalDeadline: new Date(Date.now() + 5_000_000),
        instructorId,
        sectionId: academicFixture.sectionId,
        status: 'draft',
      })
      .returning({ id: assignments.id });
    const [activeAssignment] = await db
      .insert(assignments)
      .values({
        templateId,
        title: 'Active Assignment',
        finalDeadline: new Date(Date.now() + 5_000_000),
        instructorId,
        sectionId: academicFixture.sectionId,
        status: 'active',
      })
      .returning({ id: assignments.id });
    await db.insert(assignmentStudents).values({ assignmentId: draftAssignment.id, studentId });
    await db.insert(assignmentStudents).values({ assignmentId: activeAssignment.id, studentId });

    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
      user: { id: studentId, role: 'student' },
      session: {} as any,
    } as any);
    const listResult = await listStudentAssignmentsHandler({
      data: { page: 1, limit: 20, search: '' },
    });
    expect(listResult).toMatchObject({ assignments: [{ id: activeAssignment.id }] });
    expect((listResult as { assignments: unknown[] }).assignments).toHaveLength(1);

    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
      user: { id: otherInstructorId, role: 'instructor' },
      session: {} as any,
    } as any);
    const detailResult = await getAssignmentDetailHandler({ data: { id: activeAssignment.id } });
    expect(detailResult).toBeNull();
  });

  it('allows only draft-to-active and active-to-archived lifecycle transitions under lock', async () => {
    const [assignment] = await db
      .insert(assignments)
      .values({
        templateId,
        title: 'Lifecycle Assignment',
        finalDeadline: new Date(Date.now() + 5_000_000),
        instructorId,
        sectionId: academicFixture.sectionId,
        status: 'draft',
      })
      .returning({ id: assignments.id });
    const transition = (assignmentHandlers as Record<string, any>)
      .transitionAssignmentStatusHandler;
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
      user: { id: instructorId, role: 'instructor' },
      session: {} as any,
    } as any);

    const results = await Promise.all([
      transition({ data: { assignmentId: assignment.id, status: 'active' } }),
      transition({ data: { assignmentId: assignment.id, status: 'active' } }),
    ]);
    expect(results.filter((result) => result.success === true)).toHaveLength(1);

    const activeResult = await transition({
      data: { assignmentId: assignment.id, status: 'archived' },
    });
    expect(activeResult).toMatchObject({ success: true });
  });

  it('blocks workflow writes while an assignment is draft', async () => {
    const [assignment] = await db
      .insert(assignments)
      .values({
        templateId,
        title: 'Draft Workflow Assignment',
        finalDeadline: new Date(Date.now() + 5_000_000),
        instructorId,
        sectionId: academicFixture.sectionId,
        status: 'draft',
      })
      .returning({ id: assignments.id });
    const [checkpoint] = await db
      .insert(checkpoints)
      .values({
        assignmentId: assignment.id,
        studentId,
        name: 'Draft Checkpoint',
        order: 1,
        state: 'locked',
      })
      .returning({ id: checkpoints.id });
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
      user: { id: instructorId, role: 'instructor' },
      session: {} as any,
    } as any);

    const result = await unlockCheckpointHandler({ data: { checkpointId: checkpoint.id } });
    expect(result).toMatchObject({ error: { code: 'CONFLICT' } });
  });
});
