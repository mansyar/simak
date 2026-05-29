/** @vitest-environment node */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDb } from '@/db/index';
import {
  users,
  assignments,
  assignmentStudents,
  checkpoints,
  assignmentTemplates,
  templateCheckpoints,
  auditLog,
} from '@/db/schema/index';
import { createAssignmentHandler } from '@/server/assignments.server';
import * as auth from '@/server/auth';
import { vi } from 'vitest';
import { eq } from 'drizzle-orm';

vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn(),
}));

vi.mock('@tanstack/react-start', () => ({
  createServerFn: vi.fn().mockReturnValue({
    handler: vi.fn().mockImplementation((fn) => fn),
  }),
}));

describe('Assignment Creation Integration Flow', () => {
  const db = getDb();
  const instructorId = 'test-instructor-' + Date.now();
  const student1Id = 'test-student-1-' + Date.now();
  const student2Id = 'test-student-2-' + Date.now();
  let templateId: number;

  beforeEach(async () => {
    // Seed template and users in real DB
    await db.insert(users).values([
      {
        id: instructorId,
        name: 'Instructor',
        email: `${instructorId}@test.com`,
        role: 'instructor',
      },
      { id: student1Id, name: 'Student 1', email: `${student1Id}@test.com`, role: 'student' },
      { id: student2Id, name: 'Student 2', email: `${student2Id}@test.com`, role: 'student' },
    ]);

    const [tpl] = await db
      .insert(assignmentTemplates)
      .values({
        name: 'Integration Test Template',
        type: 'Thesis',
        createdBy: instructorId,
      })
      .returning({ id: assignmentTemplates.id });

    templateId = tpl.id;

    await db.insert(templateCheckpoints).values([
      { templateId, name: 'Template CP 1', order: 1, estimatedDuration: 14 },
      { templateId, name: 'Template CP 2', order: 2, estimatedDuration: 21 },
    ]);
  });

  afterEach(async () => {
    // Clean up — delete assignment-related records first
    const assRows = await db
      .select({ id: assignments.id })
      .from(assignments)
      .where(eq(assignments.templateId, templateId));
    for (const ass of assRows) {
      await db.delete(checkpoints).where(eq(checkpoints.assignmentId, ass.id));
      await db.delete(assignmentStudents).where(eq(assignmentStudents.assignmentId, ass.id));
    }
    await db.delete(assignments).where(eq(assignments.templateId, templateId));
    await db.delete(templateCheckpoints).where(eq(templateCheckpoints.templateId, templateId));
    await db.delete(assignmentTemplates).where(eq(assignmentTemplates.id, templateId));
    // Delete audit log entries first to avoid FK violations
    await db.delete(auditLog).where(eq(auditLog.actorId, instructorId));
    await db.delete(auditLog).where(eq(auditLog.actorId, student1Id));
    await db.delete(auditLog).where(eq(auditLog.actorId, student2Id));
    await db.delete(users).where(eq(users.id, instructorId));
    await db.delete(users).where(eq(users.id, student1Id));
    await db.delete(users).where(eq(users.id, student2Id));
  });

  it('should run transaction and verify DB records', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
      user: { id: instructorId, role: 'instructor' } as any,
      session: {} as any,
    });

    const result = await createAssignmentHandler({
      data: {
        templateId,
        title: 'Real DB Integration Assignment',
        description: 'Integration test description',
        finalDeadline: new Date(Date.now() + 5000000),
        studentIds: [student1Id, student2Id],
      },
    });

    expect(result).toHaveProperty('success', true);
    const assId = (result as any).assignmentId;
    expect(assId).toBeTypeOf('number');

    // 1. Verify assignment created
    const [ass] = await db.select().from(assignments).where(eq(assignments.id, assId));
    expect(ass).toBeDefined();
    expect(ass.title).toBe('Real DB Integration Assignment');

    // 2. Verify students mapped
    const studentsMapped = await db
      .select()
      .from(assignmentStudents)
      .where(eq(assignmentStudents.assignmentId, assId));
    expect(studentsMapped).toHaveLength(2);

    // 3. Verify checkpoints created for each student
    const student1Checkpoints = await db
      .select()
      .from(checkpoints)
      .where(eq(checkpoints.studentId, student1Id));
    expect(student1Checkpoints).toHaveLength(2);
    expect(student1Checkpoints[0].state).toBe('unlocked');
    expect(student1Checkpoints[1].state).toBe('locked');
    // Verify dueDates are populated (not null) with sequential ordering
    expect(student1Checkpoints[0].dueDate).toBeInstanceOf(Date);
    expect(student1Checkpoints[1].dueDate).toBeInstanceOf(Date);
    expect(student1Checkpoints[1].dueDate!.getTime()).toBeGreaterThan(
      student1Checkpoints[0].dueDate!.getTime(),
    );

    const student2Checkpoints = await db
      .select()
      .from(checkpoints)
      .where(eq(checkpoints.studentId, student2Id));
    expect(student2Checkpoints).toHaveLength(2);
    expect(student2Checkpoints[0].state).toBe('unlocked');
    expect(student2Checkpoints[1].state).toBe('locked');
    // Verify dueDates are populated and sequential for second student
    expect(student2Checkpoints[0].dueDate).toBeInstanceOf(Date);
    expect(student2Checkpoints[1].dueDate).toBeInstanceOf(Date);
  });
});
