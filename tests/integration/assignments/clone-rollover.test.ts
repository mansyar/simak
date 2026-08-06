/** @vitest-environment node */
import { and, eq, inArray } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '@/db/index';
import {
  assignmentGradeConfig,
  assignmentStudents,
  assignments,
  assignmentTemplates,
  auditLog,
  checkpoints,
  finalGrades,
  gradeReleaseSnapshots,
  templateCheckpoints,
  users,
} from '@/db/schema';
import { ErrorCode, isServerError } from '@/lib/errors';
import * as assignmentHandlers from '@/server/assignments.server';
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

type CloneInput = {
  data: {
    sourceAssignmentId: number;
    targetSectionId: number;
    finalDeadline: Date;
    title?: string;
    description?: string | null;
    studentIds?: string[];
  };
};

type CloneHandler = (input: CloneInput) => Promise<unknown>;

const handlers = assignmentHandlers as Record<string, unknown>;
const db = getDb();
const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const instructorId = `clone-instructor-${runId}`;
const otherInstructorId = `clone-other-instructor-${runId}`;
const sourceStudentId = `clone-source-student-${runId}`;
const targetStudentId = `clone-target-student-${runId}`;
const outsiderStudentId = `clone-outsider-student-${runId}`;

let templateId: number;
let sourceAssignmentId: number;
let sourceFixture: AcademicSectionFixture;
let targetFixture: AcademicSectionFixture;
let unauthorizedFixture: AcademicSectionFixture;

function getHandler(name: 'cloneAssignmentHandler' | 'rolloverAssignmentHandler') {
  const handler = handlers[name] as CloneHandler | undefined;
  expect(typeof handler).toBe('function');
  return handler;
}

function expectError(result: unknown, code: ErrorCode) {
  expect(isServerError(result)).toBe(true);
  if (isServerError(result)) expect(result.error.code).toBe(code);
}

beforeEach(async () => {
  await db.insert(users).values([
    {
      id: instructorId,
      name: 'Clone Instructor',
      email: `${instructorId}@test.com`,
      role: 'instructor',
    },
    {
      id: otherInstructorId,
      name: 'Other Clone Instructor',
      email: `${otherInstructorId}@test.com`,
      role: 'instructor',
    },
    {
      id: sourceStudentId,
      name: 'Source Student',
      email: `${sourceStudentId}@test.com`,
      role: 'student',
    },
    {
      id: targetStudentId,
      name: 'Target Student',
      email: `${targetStudentId}@test.com`,
      role: 'student',
    },
    {
      id: outsiderStudentId,
      name: 'Outsider Student',
      email: `${outsiderStudentId}@test.com`,
      role: 'student',
    },
  ]);

  sourceFixture = await createAcademicSectionFixture(db, `${runId}-source`, instructorId, [
    sourceStudentId,
  ]);
  targetFixture = await createAcademicSectionFixture(db, `${runId}-target`, instructorId, [
    targetStudentId,
  ]);
  unauthorizedFixture = await createAcademicSectionFixture(
    db,
    `${runId}-unauthorized`,
    otherInstructorId,
    [outsiderStudentId],
  );

  const [template] = await db
    .insert(assignmentTemplates)
    .values({
      name: `Clone Template ${runId}`,
      type: 'Thesis',
      createdBy: instructorId,
    })
    .returning({ id: assignmentTemplates.id });
  templateId = template.id;

  const [templateCheckpoint] = await db
    .insert(templateCheckpoints)
    .values({
      templateId,
      name: 'Clone Checkpoint',
      order: 1,
      estimatedDuration: 14,
    })
    .returning({ id: templateCheckpoints.id });

  const [sourceAssignment] = await db
    .insert(assignments)
    .values({
      templateId,
      sectionId: sourceFixture.sectionId,
      instructorId,
      title: `Source Assignment ${runId}`,
      description: 'Source configuration',
      finalDeadline: new Date('2030-05-01T00:00:00.000Z'),
      mode: 'individual',
      status: 'active',
      maxExtensionDays: 14,
      maxTotalExtensions: 5,
    })
    .returning({ id: assignments.id });
  sourceAssignmentId = sourceAssignment.id;

  await db.insert(assignmentStudents).values({
    assignmentId: sourceAssignmentId,
    studentId: sourceStudentId,
  });
  await db.insert(checkpoints).values({
    assignmentId: sourceAssignmentId,
    studentId: sourceStudentId,
    name: 'Clone Checkpoint',
    order: 1,
    dueDate: new Date('2030-04-01T00:00:00.000Z'),
    minConsultations: 1,
    state: 'submitted',
    templateCheckpointId: templateCheckpoint.id,
  });
  await db.insert(assignmentGradeConfig).values({
    assignmentId: sourceAssignmentId,
    gradingScheme: 'custom_weight',
    customWeights: { [templateCheckpoint.id]: 100 },
    letterGradeBounds: { A: 90, B: 80 },
    releaseStatus: 'published',
    activeReleaseVersion: 2,
    publishedAt: new Date('2030-04-15T00:00:00.000Z'),
  });
  await db.insert(finalGrades).values({
    assignmentId: sourceAssignmentId,
    studentId: sourceStudentId,
    numericScore: '95',
    letterGrade: 'A',
    status: 'complete',
    contributingCheckpoints: [],
  });
  await db.insert(gradeReleaseSnapshots).values({
    assignmentId: sourceAssignmentId,
    studentId: sourceStudentId,
    releaseVersion: 2,
    numericScore: '95',
    letterGrade: 'A',
    status: 'complete',
    contributingCheckpoints: [],
    publishedAt: new Date('2030-04-15T00:00:00.000Z'),
  });
  await db.insert(auditLog).values({
    actorId: instructorId,
    action: 'assignment.created',
    entityType: 'assignment',
    entityId: String(sourceAssignmentId),
    details: { source: 'fixture' },
  });
});

afterEach(async () => {
  const assignmentRows = await db
    .select({ id: assignments.id })
    .from(assignments)
    .where(eq(assignments.templateId, templateId));
  const assignmentIds = assignmentRows.map((row) => row.id);

  if (assignmentIds.length > 0) {
    await db.delete(checkpoints).where(inArray(checkpoints.assignmentId, assignmentIds));
    await db
      .delete(assignmentStudents)
      .where(inArray(assignmentStudents.assignmentId, assignmentIds));
    await db.delete(assignments).where(inArray(assignments.id, assignmentIds));
  }
  await db.delete(templateCheckpoints).where(eq(templateCheckpoints.templateId, templateId));
  await db.delete(assignmentTemplates).where(eq(assignmentTemplates.id, templateId));
  await deleteAcademicSectionFixture(db, sourceFixture);
  await deleteAcademicSectionFixture(db, targetFixture);
  await deleteAcademicSectionFixture(db, unauthorizedFixture);
  await db.delete(auditLog).where(inArray(auditLog.actorId, [instructorId, otherInstructorId]));
  await db
    .delete(users)
    .where(
      inArray(users.id, [
        instructorId,
        otherInstructorId,
        sourceStudentId,
        targetStudentId,
        outsiderStudentId,
      ]),
    );
});

describe('assignment clone and semester rollover', () => {
  it('creates an independent configuration without copying students or history', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
      user: { id: instructorId, role: 'instructor' },
      session: {} as any,
    } as any);
    const handler = getHandler('cloneAssignmentHandler');
    if (!handler) return;

    const result = await handler({
      data: {
        sourceAssignmentId,
        targetSectionId: targetFixture.sectionId,
        title: `Cloned Assignment ${runId}`,
        finalDeadline: new Date('2030-08-01T00:00:00.000Z'),
        studentIds: [],
      },
    });
    expect(result).toMatchObject({ success: true });
    const targetId = (result as { assignmentId: number }).assignmentId;

    const [target] = await db
      .select({
        templateId: assignments.templateId,
        sectionId: assignments.sectionId,
        status: assignments.status,
        mode: assignments.mode,
        maxExtensionDays: assignments.maxExtensionDays,
        maxTotalExtensions: assignments.maxTotalExtensions,
      })
      .from(assignments)
      .where(eq(assignments.id, targetId));
    expect(target).toEqual({
      templateId,
      sectionId: targetFixture.sectionId,
      status: 'draft',
      mode: 'individual',
      maxExtensionDays: 14,
      maxTotalExtensions: 5,
    });
    expect(
      await db
        .select({ id: assignmentStudents.id })
        .from(assignmentStudents)
        .where(eq(assignmentStudents.assignmentId, targetId)),
    ).toHaveLength(0);
    expect(
      await db
        .select({ id: checkpoints.id })
        .from(checkpoints)
        .where(eq(checkpoints.assignmentId, targetId)),
    ).toHaveLength(0);
    expect(
      await db
        .select({ id: finalGrades.id })
        .from(finalGrades)
        .where(eq(finalGrades.assignmentId, targetId)),
    ).toHaveLength(0);
    expect(
      await db
        .select({ id: gradeReleaseSnapshots.id })
        .from(gradeReleaseSnapshots)
        .where(eq(gradeReleaseSnapshots.assignmentId, targetId)),
    ).toHaveLength(0);

    const source = await db
      .select({ status: assignments.status, sectionId: assignments.sectionId })
      .from(assignments)
      .where(eq(assignments.id, sourceAssignmentId));
    expect(source).toEqual([{ status: 'active', sectionId: sourceFixture.sectionId }]);
  });

  it('creates fresh participation and checkpoint state only for explicit students', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
      user: { id: instructorId, role: 'instructor' },
      session: {} as any,
    } as any);
    const handler = getHandler('rolloverAssignmentHandler');
    if (!handler) return;

    const result = await handler({
      data: {
        sourceAssignmentId,
        targetSectionId: targetFixture.sectionId,
        finalDeadline: new Date('2030-09-01T00:00:00.000Z'),
        studentIds: [targetStudentId],
      },
    });
    expect(result).toMatchObject({ success: true });
    const targetId = (result as { assignmentId: number }).assignmentId;
    const [targetCheckpoint] = await db
      .select({ id: checkpoints.id, state: checkpoints.state, studentId: checkpoints.studentId })
      .from(checkpoints)
      .where(eq(checkpoints.assignmentId, targetId));
    expect(targetCheckpoint).toMatchObject({ state: 'unlocked', studentId: targetStudentId });
    expect(targetCheckpoint.id).not.toBe(0);
    expect(
      await db
        .select({ id: finalGrades.id })
        .from(finalGrades)
        .where(eq(finalGrades.assignmentId, targetId)),
    ).toHaveLength(0);
    expect(
      await db
        .select({ id: gradeReleaseSnapshots.id })
        .from(gradeReleaseSnapshots)
        .where(eq(gradeReleaseSnapshots.assignmentId, targetId)),
    ).toHaveLength(0);
  });

  it('allows archived sources but rejects draft sources', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
      user: { id: instructorId, role: 'instructor' },
      session: {} as any,
    } as any);
    await db
      .update(assignments)
      .set({ status: 'archived' })
      .where(eq(assignments.id, sourceAssignmentId));
    const archivedResult = await getHandler('cloneAssignmentHandler')?.({
      data: {
        sourceAssignmentId,
        targetSectionId: targetFixture.sectionId,
        finalDeadline: new Date('2030-10-01T00:00:00.000Z'),
      },
    });
    expect(archivedResult).toMatchObject({ success: true });

    await db
      .update(assignments)
      .set({ status: 'draft' })
      .where(eq(assignments.id, sourceAssignmentId));
    const draftResult = await getHandler('cloneAssignmentHandler')?.({
      data: {
        sourceAssignmentId,
        targetSectionId: targetFixture.sectionId,
        finalDeadline: new Date('2030-11-01T00:00:00.000Z'),
      },
    });
    expectError(draftResult, ErrorCode.CONFLICT);
  });

  it('rejects unauthorized source/target access and rolls back invalid student selection', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
      user: { id: otherInstructorId, role: 'instructor' },
      session: {} as any,
    } as any);
    const handler = getHandler('cloneAssignmentHandler');
    if (!handler) return;
    const unauthorizedResult = await handler({
      data: {
        sourceAssignmentId,
        targetSectionId: targetFixture.sectionId,
        finalDeadline: new Date('2030-12-01T00:00:00.000Z'),
      },
    });
    expectError(unauthorizedResult, ErrorCode.FORBIDDEN);

    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
      user: { id: instructorId, role: 'instructor' },
      session: {} as any,
    } as any);
    const invalidStudentResult = await handler({
      data: {
        sourceAssignmentId,
        targetSectionId: targetFixture.sectionId,
        finalDeadline: new Date('2031-01-01T00:00:00.000Z'),
        studentIds: [outsiderStudentId],
      },
    });
    expectError(invalidStudentResult, ErrorCode.BAD_REQUEST);
    const createdForTemplate = await db
      .select({ id: assignments.id })
      .from(assignments)
      .where(and(eq(assignments.templateId, templateId), eq(assignments.id, sourceAssignmentId)));
    expect(createdForTemplate).toHaveLength(1);
  });

  it('creates independent targets for concurrent clone requests', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
      user: { id: instructorId, role: 'instructor' },
      session: {} as any,
    } as any);
    const handler = getHandler('cloneAssignmentHandler');
    if (!handler) return;
    const results = await Promise.all([
      handler({
        data: {
          sourceAssignmentId,
          targetSectionId: targetFixture.sectionId,
          finalDeadline: new Date('2031-02-01T00:00:00.000Z'),
        },
      }),
      handler({
        data: {
          sourceAssignmentId,
          targetSectionId: targetFixture.sectionId,
          finalDeadline: new Date('2031-03-01T00:00:00.000Z'),
        },
      }),
    ]);
    expect(results.every((result) => !isServerError(result))).toBe(true);
    const ids = results.map((result) => (result as { assignmentId: number }).assignmentId);
    expect(new Set(ids).size).toBe(2);
    expect(
      await db.select({ id: assignments.id }).from(assignments).where(inArray(assignments.id, ids)),
    ).toHaveLength(2);
  });
});
