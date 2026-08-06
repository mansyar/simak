/** @vitest-environment node */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db/index';
import {
  users,
  assignments,
  assignmentStudents,
  checkpoints,
  assignmentTemplates,
  templateCheckpoints,
  submissions,
  uploadIntents,
} from '@/db/schema/index';
import { submitCheckpointHandler } from '@/server/submissions.server';
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

vi.mock('@/lib/storage', () => ({
  getObjectContentLength: vi.fn().mockResolvedValue({ ok: true, size: 1024 }),
}));

describe('submitCheckpointHandler fabricated-key rejection end-to-end', () => {
  const db = getDb();
  const timestamp = Date.now();
  const instructorId = `intent-instructor-${timestamp}`;
  const studentId = `intent-student-${timestamp}`;
  let academicFixture: AcademicSectionFixture;
  let templateId: number;
  let assignmentId: number;
  let checkpointId: number;

  beforeEach(async () => {
    await db.insert(users).values([
      {
        id: instructorId,
        name: 'Intent Instructor',
        email: `${instructorId}@test.com`,
        role: 'instructor',
      },
      {
        id: studentId,
        name: 'Intent Student',
        email: `${studentId}@test.com`,
        role: 'student',
      },
    ]);

    academicFixture = await createAcademicSectionFixture(db, `intent-${timestamp}`, instructorId, [
      studentId,
    ]);

    const [template] = await db
      .insert(assignmentTemplates)
      .values({
        name: 'Intent Test Template',
        type: 'Thesis',
        createdBy: instructorId,
      })
      .returning({ id: assignmentTemplates.id });

    templateId = template.id;

    const [assignment] = await db
      .insert(assignments)
      .values({
        templateId,
        title: 'Intent Test Assignment',
        finalDeadline: new Date(Date.now() + 5000000),
        instructorId,
        sectionId: academicFixture.sectionId,
      })
      .returning({ id: assignments.id });

    assignmentId = assignment.id;

    await db.insert(assignmentStudents).values({
      assignmentId,
      studentId,
    });

    const [checkpoint] = await db
      .insert(checkpoints)
      .values({
        assignmentId,
        studentId,
        name: 'Intent Checkpoint',
        order: 1,
        state: 'unlocked',
        dueDate: new Date(Date.now() + 1000000),
      })
      .returning({ id: checkpoints.id });

    checkpointId = checkpoint.id;

    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
      user: { id: studentId, name: 'Intent Student', role: 'student' },
      session: {} as any,
    } as any);
  });

  afterEach(async () => {
    await db.delete(uploadIntents).where(eq(uploadIntents.userId, studentId));
    await db.delete(submissions).where(eq(submissions.checkpointId, checkpointId));
    await db.delete(checkpoints).where(eq(checkpoints.id, checkpointId));
    await db.delete(assignmentStudents).where(eq(assignmentStudents.assignmentId, assignmentId));
    await db.delete(assignments).where(eq(assignments.id, assignmentId));
    await deleteAcademicSectionFixture(db, academicFixture);
    await db.delete(templateCheckpoints).where(eq(templateCheckpoints.templateId, templateId));
    await db.delete(assignmentTemplates).where(eq(assignmentTemplates.id, templateId));
    await db.delete(users).where(eq(users.id, studentId));
    await db.delete(users).where(eq(users.id, instructorId));
  });

  it('AC-H1-5: rejects a fabricated fileKey with no matching upload intent', async () => {
    const result = await submitCheckpointHandler({
      data: {
        checkpointId,
        fileKey: 'submissions/fabricated-key.pdf',
        fileName: 'fabricated.pdf',
        fileSize: 1024,
      },
    });

    expect(result).toEqual({
      error: { code: 'BAD_REQUEST', message: 'Invalid or expired upload intent' },
    });

    const remaining = await db
      .select({ id: submissions.id })
      .from(submissions)
      .where(eq(submissions.checkpointId, checkpointId));

    expect(remaining).toHaveLength(0);
  });
});
