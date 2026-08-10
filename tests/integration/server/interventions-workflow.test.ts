/** @vitest-environment node */
import { eq, inArray, or } from 'drizzle-orm';
import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from 'vitest';
import { getDb } from '@/db/index';
import {
  assignmentStudents,
  assignments,
  assignmentTemplates,
  academicTerms,
  auditLog,
  checkpoints,
  interventions,
  notifications,
  riskObservations,
  users,
} from '@/db/schema/index';
import {
  createAcademicSectionFixture,
  deleteAcademicSectionFixture,
  type AcademicSectionFixture,
} from '../helpers/academic-context';
import * as auth from '@/server/auth';
import {
  getInterventionContextHandler,
  listInterventionsHandler,
  updateInterventionHandler,
} from '@/server/interventions.server';
import { listInstructorRiskHistoryHandler } from '@/server/risk-history.server';
import {
  processDailyRiskSnapshots,
  processRiskObservationRetention,
} from '@/server/risk-history-jobs.server';
import { recordRiskObservation } from '@/server/risk-observation-recorder.server';

vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn(),
}));

describe('intervention workflow database acceptance', () => {
  const db = getDb();
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const instructorId = `intervention-instructor-${suffix}`;
  const replacementInstructorId = `intervention-replacement-${suffix}`;
  const studentId = `intervention-student-${suffix}`;
  let academicFixture: AcademicSectionFixture;
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

    academicFixture = await createAcademicSectionFixture(
      db,
      `intervention-${suffix}`,
      instructorId,
      [studentId],
    );

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
        sectionId: academicFixture.sectionId,
        mode: 'individual',
        status: 'active',
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
    await db
      .delete(riskObservations)
      .where(
        or(
          eq(riskObservations.assignmentId, assignmentId),
          eq(riskObservations.academicTermId, academicFixture.termId),
        ),
      );
    await db.delete(interventions).where(eq(interventions.assignmentId, assignmentId));
  });

  afterAll(async () => {
    await db.delete(auditLog).where(eq(auditLog.actorId, instructorId));
    await db.delete(auditLog).where(eq(auditLog.actorId, replacementInstructorId));
    await db
      .delete(riskObservations)
      .where(
        or(
          eq(riskObservations.assignmentId, assignmentId),
          eq(riskObservations.academicTermId, academicFixture.termId),
        ),
      );
    await db.delete(interventions).where(eq(interventions.assignmentId, assignmentId));
    await db.delete(checkpoints).where(eq(checkpoints.id, checkpointId));
    await db.delete(assignmentStudents).where(eq(assignmentStudents.assignmentId, assignmentId));
    await db.delete(assignments).where(eq(assignments.id, assignmentId));
    await deleteAcademicSectionFixture(db, academicFixture);
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
    const notificationRecipients = [instructorId, replacementInstructorId, studentId];
    const notificationsBefore = await db
      .select()
      .from(notifications)
      .where(inArray(notifications.userId, notificationRecipients));

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

    const observations = await db
      .select({ eventType: riskObservations.eventType })
      .from(riskObservations)
      .where(eq(riskObservations.interventionId, created.id));
    expect(observations).toEqual([
      { eventType: 'intervention_updated' },
      { eventType: 'intervention_updated' },
    ]);
    const notificationsAfter = await db
      .select()
      .from(notifications)
      .where(inArray(notifications.userId, notificationRecipients));
    expect(notificationsAfter).toHaveLength(notificationsBefore.length);
  });

  it('scopes visibility to the current assignment owner after reassignment', async () => {
    const [created] = await db
      .insert(interventions)
      .values({ assignmentId, studentId, actionType: 'other' })
      .returning({ id: interventions.id });
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
      user: { id: instructorId, role: 'instructor' },
    } as any);
    await updateInterventionHandler({
      data: { interventionId: created.id, status: 'monitoring' },
    });
    const historyBefore = await listInstructorRiskHistoryHandler({
      data: { assignmentId, studentId, from: null, to: null, page: 1, limit: 20 },
    });
    expect(historyBefore).toMatchObject({ total: 1 });
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
    const formerHistory = await listInstructorRiskHistoryHandler({
      data: { assignmentId, studentId, from: null, to: null, page: 1, limit: 20 },
    });
    expect(formerHistory).toMatchObject({ error: { code: 'NOT_FOUND' } });

    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
      user: { id: replacementInstructorId, role: 'instructor' },
    } as any);
    const replacement = await listInterventionsHandler({
      data: { assignmentId, page: 1, limit: 20, overdue: false },
    });
    expect(replacement).toMatchObject({ total: 1, interventions: [{ id: created.id }] });
    const replacementHistory = await listInstructorRiskHistoryHandler({
      data: { assignmentId, studentId, from: null, to: null, page: 1, limit: 20 },
    });
    expect(replacementHistory).toMatchObject({ total: 1 });

    const context = await getInterventionContextHandler({
      data: { assignmentId, studentId },
    });
    expect(context).toMatchObject({ context: { assignmentId, studentId } });
  });

  it('persists empty-context snapshots and anonymizes lifecycle rows in PostgreSQL', async () => {
    const now = new Date('2026-08-10T05:30:00.000Z');
    await db.update(checkpoints).set({ state: 'passed' }).where(eq(checkpoints.id, checkpointId));

    try {
      await expect(
        recordRiskObservation(db, {
          source: 'lifecycle_event',
          eventType: 'review_recorded',
          sourceEventId: `review:passed:${suffix}`,
          assignmentId,
          studentId,
          checkpointId,
          actorId: instructorId,
          observedAt: now,
        }),
      ).resolves.toMatchObject({ created: true });
      const dailyResult = await processDailyRiskSnapshots({ db, now });
      expect(dailyResult.created).toBeGreaterThanOrEqual(1);

      const identifiable = await db
        .select({
          riskLevel: riskObservations.riskLevel,
          factorSnapshot: riskObservations.factorSnapshot,
        })
        .from(riskObservations)
        .where(eq(riskObservations.assignmentId, assignmentId));
      expect(identifiable).toHaveLength(2);
      expect(identifiable).toEqual(
        expect.arrayContaining([expect.objectContaining({ riskLevel: 'low', factorSnapshot: [] })]),
      );

      await db
        .update(academicTerms)
        .set({ startDate: '2020-01-01', endDate: '2020-06-30' })
        .where(eq(academicTerms.id, academicFixture.termId));
      await expect(processRiskObservationRetention({ db, now })).resolves.toMatchObject({
        anonymized: 2,
      });

      const anonymized = await db
        .select({
          retentionState: riskObservations.retentionState,
          assignmentId: riskObservations.assignmentId,
          studentId: riskObservations.studentId,
          eventType: riskObservations.eventType,
          sourceEventId: riskObservations.sourceEventId,
          factorSnapshot: riskObservations.factorSnapshot,
        })
        .from(riskObservations)
        .where(eq(riskObservations.academicTermId, academicFixture.termId));
      expect(anonymized).toHaveLength(2);
      expect(anonymized).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            retentionState: 'anonymized',
            assignmentId: null,
            studentId: null,
            eventType: null,
            sourceEventId: null,
            factorSnapshot: [],
          }),
        ]),
      );
    } finally {
      await db
        .update(academicTerms)
        .set({ startDate: '2026-01-01', endDate: '2026-06-30' })
        .where(eq(academicTerms.id, academicFixture.termId));
      await db
        .update(checkpoints)
        .set({ state: 'unlocked' })
        .where(eq(checkpoints.id, checkpointId));
    }
  });
});
