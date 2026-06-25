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
} from '@/db/schema/index';
import { submitCheckpointHandler } from '@/server/submissions.server';
import * as auth from '@/server/auth';

vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn(),
}));

vi.mock('@tanstack/react-start', () => ({
  createServerFn: vi.fn().mockReturnValue({
    inputValidator: vi.fn().mockReturnThis(),
    handler: vi.fn().mockImplementation((fn) => fn),
  }),
}));

describe('submitCheckpointHandler concurrent version race', () => {
  const db = getDb();
  const timestamp = Date.now();
  const instructorId = `race-instructor-${timestamp}`;
  const studentId = `race-student-${timestamp}`;
  let templateId: number;
  let assignmentId: number;
  let checkpointId: number;

  beforeEach(async () => {
    await db.insert(users).values([
      {
        id: instructorId,
        name: 'Race Instructor',
        email: `${instructorId}@test.com`,
        role: 'instructor',
      },
      {
        id: studentId,
        name: 'Race Student',
        email: `${studentId}@test.com`,
        role: 'student',
      },
    ]);

    const [template] = await db
      .insert(assignmentTemplates)
      .values({
        name: 'Race Test Template',
        type: 'Thesis',
        createdBy: instructorId,
      })
      .returning({ id: assignmentTemplates.id });

    templateId = template.id;

    const [assignment] = await db
      .insert(assignments)
      .values({
        templateId,
        title: 'Race Test Assignment',
        finalDeadline: new Date(Date.now() + 5000000),
        instructorId,
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
        name: 'Race Checkpoint',
        order: 1,
        state: 'unlocked',
        dueDate: new Date(Date.now() + 1000000),
      })
      .returning({ id: checkpoints.id });

    checkpointId = checkpoint.id;

    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
      user: { id: studentId, name: 'Race Student' },
      session: {} as any,
    } as any);
  });

  afterEach(async () => {
    await db.delete(submissions).where(eq(submissions.checkpointId, checkpointId));
    await db.delete(checkpoints).where(eq(checkpoints.id, checkpointId));
    await db.delete(assignmentStudents).where(eq(assignmentStudents.assignmentId, assignmentId));
    await db.delete(assignments).where(eq(assignments.id, assignmentId));
    await db.delete(templateCheckpoints).where(eq(templateCheckpoints.templateId, templateId));
    await db.delete(assignmentTemplates).where(eq(assignmentTemplates.id, templateId));
    await db.delete(users).where(eq(users.id, studentId));
    await db.delete(users).where(eq(users.id, instructorId));
  });

  it('prevents duplicate versions when two submissions run concurrently', async () => {
    const dataA = {
      checkpointId,
      fileKey: `submissions/race-a-${timestamp}.pdf`,
      fileName: 'race-a.pdf',
      fileSize: 1024,
    };
    const dataB = {
      checkpointId,
      fileKey: `submissions/race-b-${timestamp}.pdf`,
      fileName: 'race-b.pdf',
      fileSize: 1024,
    };

    const [resultA, resultB] = await Promise.all([
      submitCheckpointHandler({ data: dataA }),
      submitCheckpointHandler({ data: dataB }),
    ]);

    const successes = [resultA, resultB].filter(
      (r) => (r as { success?: boolean }).success === true,
    );
    const failures = [resultA, resultB].filter((r) => (r as { error?: unknown }).error);

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);

    const rows = await db
      .select({ id: submissions.id, version: submissions.version, fileKey: submissions.fileKey })
      .from(submissions)
      .where(eq(submissions.checkpointId, checkpointId));

    expect(rows).toHaveLength(1);
    expect(rows[0].version).toBe(1);
  });
});
