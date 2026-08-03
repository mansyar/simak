/** @vitest-environment node */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { and, eq, inArray, or } from 'drizzle-orm';
import { getDb } from '@/db/index';
import {
  assignments,
  assignmentStudents,
  auditLog,
  checkpoints,
  reviews,
  rubricCriteria,
  submissions,
  templateCheckpoints,
  assignmentTemplates,
  users,
  revisionActionItems,
} from '@/db/schema/index';
import { getLatestReviewHandler } from '@/server/reviews-extras.server';
import {
  insertRevisionActionItems,
  updateRevisionActionItemHandler,
  validateRevisionActionItems,
} from '@/server/revision-action-items.server';
import * as auth from '@/server/auth';

vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn(),
}));

describe('revision action items against PostgreSQL', () => {
  const db = getDb();
  const suffix = Date.now();
  const instructorId = `revision-plan-instructor-${suffix}`;
  const studentId = `revision-plan-student-${suffix}`;
  const otherStudentId = `revision-plan-other-${suffix}`;
  let assignmentId: number;
  let templateId: number;
  let rubricTemplateCheckpointId: number;
  let rubricCheckpointId: number;
  let plainCheckpointId: number;
  let rubricSubmissionId: number;
  let plainSubmissionId: number;

  beforeAll(async () => {
    await db.insert(users).values([
      {
        id: instructorId,
        name: 'Revision Plan Instructor',
        email: `${instructorId}@test.com`,
        role: 'instructor',
        locale: 'en',
      },
      {
        id: studentId,
        name: 'Revision Plan Student',
        email: `${studentId}@test.com`,
        role: 'student',
        locale: 'en',
      },
      {
        id: otherStudentId,
        name: 'Other Revision Plan Student',
        email: `${otherStudentId}@test.com`,
        role: 'student',
        locale: 'en',
      },
    ]);

    const [template] = await db
      .insert(assignmentTemplates)
      .values({ name: 'Revision Plan Template', type: 'thesis', createdBy: instructorId })
      .returning({ id: assignmentTemplates.id });
    templateId = template.id;

    const [rubricTemplateCheckpoint] = await db
      .insert(templateCheckpoints)
      .values({
        templateId,
        name: 'Rubric Checkpoint',
        order: 1,
        gradingType: 'numeric',
      })
      .returning({ id: templateCheckpoints.id });
    rubricTemplateCheckpointId = rubricTemplateCheckpoint.id;

    await db.insert(rubricCriteria).values({
      templateCheckpointId: rubricTemplateCheckpointId,
      title: 'Methodology',
      description: 'Research methodology',
      weight: 100,
      order: 1,
    });

    const [assignment] = await db
      .insert(assignments)
      .values({
        templateId,
        title: 'Revision Plan Assignment',
        finalDeadline: new Date(Date.now() + 86_400_000),
        instructorId,
      })
      .returning({ id: assignments.id });
    assignmentId = assignment.id;

    await db.insert(assignmentStudents).values({ assignmentId, studentId });

    const [rubricCheckpoint] = await db
      .insert(checkpoints)
      .values({
        assignmentId,
        studentId,
        name: 'Rubric Checkpoint',
        order: 1,
        state: 'revise',
        templateCheckpointId: rubricTemplateCheckpointId,
      })
      .returning({ id: checkpoints.id });
    rubricCheckpointId = rubricCheckpoint.id;

    const [plainCheckpoint] = await db
      .insert(checkpoints)
      .values({
        assignmentId,
        studentId,
        name: 'Plain Checkpoint',
        order: 2,
        state: 'revise',
      })
      .returning({ id: checkpoints.id });
    plainCheckpointId = plainCheckpoint.id;

    const [rubricSubmission] = await db
      .insert(submissions)
      .values({
        checkpointId: rubricCheckpointId,
        uploadedBy: studentId,
        fileKey: `revision-plan-${suffix}-rubric.pdf`,
        fileName: 'rubric.pdf',
        fileSize: 100,
        version: 1,
      })
      .returning({ id: submissions.id });
    rubricSubmissionId = rubricSubmission.id;

    const [plainSubmission] = await db
      .insert(submissions)
      .values({
        checkpointId: plainCheckpointId,
        uploadedBy: studentId,
        fileKey: `revision-plan-${suffix}-plain.pdf`,
        fileName: 'plain.pdf',
        fileSize: 100,
        version: 1,
      })
      .returning({ id: submissions.id });
    plainSubmissionId = plainSubmission.id;
  });

  afterAll(async () => {
    await db
      .delete(auditLog)
      .where(or(eq(auditLog.actorId, studentId), eq(auditLog.actorId, instructorId)));
    await db
      .delete(reviews)
      .where(inArray(reviews.submissionId, [rubricSubmissionId, plainSubmissionId]));
    await db
      .delete(submissions)
      .where(inArray(submissions.id, [rubricSubmissionId, plainSubmissionId]));
    await db
      .delete(checkpoints)
      .where(inArray(checkpoints.id, [rubricCheckpointId, plainCheckpointId]));
    await db.delete(assignmentStudents).where(eq(assignmentStudents.assignmentId, assignmentId));
    await db.delete(assignments).where(eq(assignments.id, assignmentId));
    await db
      .delete(rubricCriteria)
      .where(eq(rubricCriteria.templateCheckpointId, rubricTemplateCheckpointId));
    await db.delete(templateCheckpoints).where(eq(templateCheckpoints.templateId, templateId));
    await db.delete(assignmentTemplates).where(eq(assignmentTemplates.id, templateId));
    await db.delete(users).where(inArray(users.id, [studentId, otherStudentId, instructorId]));
  });

  async function createReview(
    submissionId: number,
    createdAt: Date,
    comment: string,
  ): Promise<number> {
    const [review] = await db
      .insert(reviews)
      .values({
        submissionId,
        instructorId,
        decision: 'revise',
        comment,
        createdAt,
        reviewedAt: createdAt,
      })
      .returning({ id: reviews.id });
    return review.id;
  }

  it('stores criterion snapshots, order, and plain-text items for rubric and no-rubric checkpoints', async () => {
    const [criterion] = await db
      .select({ id: rubricCriteria.id })
      .from(rubricCriteria)
      .where(eq(rubricCriteria.templateCheckpointId, rubricTemplateCheckpointId));
    const reviewId = await createReview(
      rubricSubmissionId,
      new Date('2026-01-01T00:00:00Z'),
      'Rubric plan',
    );

    const insertResult = await insertRevisionActionItems(db, {
      reviewId,
      templateCheckpointId: rubricTemplateCheckpointId,
      actionItems: [
        { itemText: ' Revise the methodology section ', criterionId: criterion.id },
        { itemText: 'Add a source comparison' },
      ],
    });
    expect(insertResult).toEqual({ inserted: 2 });

    const rows = await db
      .select()
      .from(revisionActionItems)
      .where(eq(revisionActionItems.reviewId, reviewId))
      .orderBy(revisionActionItems.order);
    expect(rows.map((row) => [row.order, row.itemText, row.criterionTitle])).toEqual([
      [0, 'Revise the methodology section', 'Methodology'],
      [1, 'Add a source comparison', null],
    ]);

    const plainReviewId = await createReview(
      plainSubmissionId,
      new Date('2026-01-02T00:00:00Z'),
      'Plain plan',
    );
    expect(
      await insertRevisionActionItems(db, {
        reviewId: plainReviewId,
        templateCheckpointId: null,
        actionItems: [{ itemText: 'Rewrite the conclusion' }],
      }),
    ).toEqual({ inserted: 1 });
    expect(
      await validateRevisionActionItems(db, null, [
        { itemText: 'A criterion is not available here', criterionId: criterion.id },
      ]),
    ).toMatchObject({ error: { code: 'BAD_REQUEST' } });
  });

  it('rolls back action items with the surrounding review transaction', async () => {
    await expect(
      db.transaction(async (tx) => {
        const [review] = await tx
          .insert(reviews)
          .values({
            submissionId: plainSubmissionId,
            instructorId,
            decision: 'revise',
            comment: 'Rolled back plan',
          })
          .returning({ id: reviews.id });
        await insertRevisionActionItems(tx, {
          reviewId: review.id,
          templateCheckpointId: null,
          actionItems: [{ itemText: 'This must roll back' }],
        });
        throw new Error('force transaction rollback');
      }),
    ).rejects.toThrow('force transaction rollback');

    const rows = await db
      .select({ reviewId: reviews.id })
      .from(reviews)
      .where(
        and(eq(reviews.submissionId, plainSubmissionId), eq(reviews.comment, 'Rolled back plan')),
      );
    expect(rows).toHaveLength(0);
  });

  it('returns immutable history and permits addressed reversal only on the current plan', async () => {
    const oldReviewId = await createReview(
      rubricSubmissionId,
      new Date('2026-02-01T00:00:00Z'),
      'First revision plan',
    );
    const newReviewId = await createReview(
      rubricSubmissionId,
      new Date('2026-02-02T00:00:00Z'),
      'Current revision plan',
    );
    const [oldItem] = await db
      .insert(revisionActionItems)
      .values({ reviewId: oldReviewId, itemText: 'Old item', order: 0 })
      .returning({ id: revisionActionItems.id });
    const [currentItem] = await db
      .insert(revisionActionItems)
      .values({ reviewId: newReviewId, itemText: 'Current item', order: 0 })
      .returning({ id: revisionActionItems.id });

    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
      user: { id: studentId, name: 'Revision Plan Student', role: 'student', locale: 'en' },
      session: {} as any,
    } as any);
    const latest = await getLatestReviewHandler({ data: { checkpointId: rubricCheckpointId } });
    expect(latest).toMatchObject({
      review: { id: newReviewId, comment: 'Current revision plan' },
      actionItems: [{ id: currentItem.id, itemText: 'Current item', order: 0 }],
    });
    expect((latest as any).reviewHistory.slice(0, 2).map((review: any) => review.id)).toEqual([
      newReviewId,
      oldReviewId,
    ]);
    expect((latest as any).reviewHistory[1].actionItems[0]).toMatchObject({ id: oldItem.id });

    expect(
      await updateRevisionActionItemHandler({ data: { itemId: oldItem.id, addressed: true } }),
    ).toEqual({
      error: { code: 'NOT_FOUND', message: 'Current revision action item not found' },
    });
    expect(
      await updateRevisionActionItemHandler({ data: { itemId: currentItem.id, addressed: true } }),
    ).toEqual({
      success: true,
    });
    expect(
      await updateRevisionActionItemHandler({ data: { itemId: currentItem.id, addressed: false } }),
    ).toEqual({
      success: true,
    });

    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
      user: { id: otherStudentId, name: 'Other Student', role: 'student', locale: 'en' },
      session: {} as any,
    } as any);
    expect(
      await updateRevisionActionItemHandler({ data: { itemId: currentItem.id, addressed: true } }),
    ).toEqual({
      error: { code: 'NOT_FOUND', message: 'Current revision action item not found' },
    });

    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
      user: {
        id: instructorId,
        name: 'Revision Plan Instructor',
        role: 'instructor',
        locale: 'en',
      },
      session: {} as any,
    } as any);
    expect(
      await updateRevisionActionItemHandler({ data: { itemId: currentItem.id, addressed: true } }),
    ).toEqual({
      error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
    });
  });
});
