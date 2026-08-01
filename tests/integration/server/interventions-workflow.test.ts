/** @vitest-environment node */
import { eq } from 'drizzle-orm';
import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from 'vitest';
import { getDb } from '@/db/index';
import {
  assignmentStudents,
  assignments,
  assignmentTemplates,
  auditLog,
  checkpoints,
  interventions,
  users,
} from '@/db/schema/index';
import * as auth from '@/server/auth';
import {
  getInterventionContextHandler,
  listInterventionsHandler,
  updateInterventionHandler,
} from '@/server/interventions.server';

vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn(),
}));

describe('intervention workflow database acceptance', () => {
  const db = getDb();
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const instructorId = `intervention-instructor-${suffix}`;
  const replacementInstructorId = `intervention-replacement-${suffix}`;
  const studentId = `intervention-student-${suffix}`;
  let assignmentId: number;
  let checkpointId: number;

  beforeAll(async () => {
    await db.insert(users).values([
      {
        id: instructorId,
        name: 'Intervention Instructor',
        email: `${instructorId}@test.local`,
        role: 'instructor',
        emailVerified: true,
      },
      {
        id: replacementInstructorId,
        name: 'Replacement Instructor',
        email: `${replacementInstructorId}@test.local`,
        role: 'instructor',
        emailVerified: true,
      },
      {
        id: studentId,
        name: 'Intervention Student',
        email: `${studentId}@test.local`,
        role: 'student',
        emailVerified: true,
      },
    ]);

    const [template] = await db
      .insert(assignmentTemplates)
      .values({
        type: 'thesis',
        name: `Intervention Template ${suffix}`,
        createdBy: instructorId,
      })
      .returning({ id: assignmentTemplates.id });

    const [assignment] = await db
      .insert(assignments)
      .values({
        templateId: template.id,
        title: `Intervention Assignment ${suffix}`,
        finalDeadline: new Date(Date.now() + 86_400_000),
        instructorId,
      })
      .returning({ id: assignments.id });
    assignmentId = assignment.id;

    await db.insert(assignmentStudents).values({ assignmentId, studentId });

    const [checkpoint] = await db
      .insert(checkpoints)
      .values({
        assignmentId,
        studentId,
        name: 'Overdue checkpoint',
        order: 1,
        state: 'unlocked',
        dueDate: new Date(Date.now() - 86_400_000),
        minConsultations: 0,
      })
      .returning({ id: checkpoints.id });
    checkpointId = checkpoint.id;
  });

  beforeEach(async () => {
    await db.delete(auditLog).where(eq(auditLog.actorId, instructorId));
    await db.delete(interventions).where(eq(interventions.assignmentId, assignmentId));
  });

  afterAll(async () => {
    await db.delete(auditLog).where(eq(auditLog.actorId, instructorId));
    await db.delete(auditLog).where(eq(auditLog.actorId, replacementInstructorId));
    await db.delete(interventions).where(eq(interventions.assignmentId, assignmentId));
    await db.delete(checkpoints).where(eq(checkpoints.id, checkpointId));
    await db.delete(assignmentStudents).where(eq(assignmentStudents.assignmentId, assignmentId));
    await db.delete(assignments).where(eq(assignments.id, assignmentId));
    await db
      .delete(assignmentTemplates)
      .where(eq(assignmentTemplates.name, `Intervention Template ${suffix}`));
    await db.delete(users).where(eq(users.id, instructorId));
    await db.delete(users).where(eq(users.id, replacementInstructorId));
    await db.delete(users).where(eq(users.id, studentId));
  });

  it('enforces one active intervention per assignment and student while retaining history', async () => {
    const [first] = await db
      .insert(interventions)
      .values({ assignmentId, studentId, actionType: 'discussion' })
      .returning({ id: interventions.id });

    await expect(
      db.insert(interventions).values({ assignmentId, studentId, actionType: 'consultation' }),
    ).rejects.toThrow();

    await db
      .update(interventions)
      .set({ status: 'resolved', resolutionReason: 'Completed follow-up' })
      .where(eq(interventions.id, first.id));

    const [second] = await db
      .insert(interventions)
      .values({ assignmentId, studentId, actionType: 'extension' })
      .returning({ id: interventions.id });
    expect(second.id).not.toBe(first.id);
  });

  it('persists locked status transitions and immutable closure audit data', async () => {
    const [created] = await db
      .insert(interventions)
      .values({ assignmentId, studentId, actionType: 'discussion' })
      .returning({ id: interventions.id });
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
      user: { id: instructorId, role: 'instructor' },
    } as any);

    const monitoring = await updateInterventionHandler({
      data: { interventionId: created.id, status: 'monitoring' },
    });
    expect(monitoring).toMatchObject({ intervention: { id: created.id, status: 'monitoring' } });

    const missingReason = await updateInterventionHandler({
      data: { interventionId: created.id, status: 'resolved' },
    });
    expect(missingReason).toMatchObject({ error: { code: 'BAD_REQUEST' } });

    const resolved = await updateInterventionHandler({
      data: {
        interventionId: created.id,
        status: 'resolved',
        resolutionReason: 'Student resumed work',
      },
    });
    expect(resolved).toMatchObject({ intervention: { id: created.id, status: 'resolved' } });

    const auditRows = await db
      .select({ action: auditLog.action, details: auditLog.details })
      .from(auditLog)
      .where(eq(auditLog.entityId, String(created.id)));
    expect(auditRows.map((row) => row.action)).toContain('intervention.resolved');
    expect(auditRows.at(-1)?.details).toMatchObject({ reason: 'Student resumed work' });

    const immutable = await updateInterventionHandler({
      data: { interventionId: created.id, privateNote: 'Should not change' },
    });
    expect(immutable).toMatchObject({ error: { code: 'BAD_REQUEST' } });
  });

  it('scopes visibility to the current assignment owner after reassignment', async () => {
    const [created] = await db
      .insert(interventions)
      .values({ assignmentId, studentId, actionType: 'other' })
      .returning({ id: interventions.id });
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
      user: { id: instructorId, role: 'instructor' },
    } as any);
    const before = await listInterventionsHandler({
      data: { assignmentId, page: 1, limit: 20, overdue: false },
    });
    expect(before).toMatchObject({ total: 1 });

    await db
      .update(assignments)
      .set({ instructorId: replacementInstructorId })
      .where(eq(assignments.id, assignmentId));

    const formerOwner = await listInterventionsHandler({
      data: { assignmentId, page: 1, limit: 20, overdue: false },
    });
    expect(formerOwner).toMatchObject({ interventions: [], total: 0 });

    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
      user: { id: replacementInstructorId, role: 'instructor' },
    } as any);
    const replacement = await listInterventionsHandler({
      data: { assignmentId, page: 1, limit: 20, overdue: false },
    });
    expect(replacement).toMatchObject({ total: 1, interventions: [{ id: created.id }] });

    const context = await getInterventionContextHandler({
      data: { assignmentId, studentId },
    });
    expect(context).toMatchObject({ context: { assignmentId, studentId } });
  });
});
