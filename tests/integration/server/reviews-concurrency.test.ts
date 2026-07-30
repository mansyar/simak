/** @vitest-environment node */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { eq, or } from 'drizzle-orm';
import { getDb } from '@/db/index';
import {
  users,
  assignments,
  assignmentStudents,
  checkpoints,
  assignmentTemplates,
  templateCheckpoints,
  submissions,
  reviews,
  uploadIntents,
  notifications,
  auditLog,
} from '@/db/schema/index';
import { submitCheckpointHandler } from '@/server/submissions.server';
import { openForReviewHandler, submitReviewHandler } from '@/server/reviews.server';
import * as auth from '@/server/auth';

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

describe('Review concurrency and atomic state transitions', () => {
  const db = getDb();
  const timestamp = Date.now();
  const instructorId = `review-concurrency-instructor-${timestamp}`;
  const studentId = `review-concurrency-student-${timestamp}`;
  let templateId: number;
  let assignmentId: number;
  let checkpointId: number;
  let submissionId: number;

  beforeEach(async () => {
    await db.insert(users).values([
      {
        id: instructorId,
        name: 'Concurrency Instructor',
        email: `${instructorId}@test.com`,
        role: 'instructor',
        locale: 'en',
      },
      {
        id: studentId,
        name: 'Concurrency Student',
        email: `${studentId}@test.com`,
        role: 'student',
        locale: 'en',
      },
    ]);

    const [template] = await db
      .insert(assignmentTemplates)
      .values({
        name: 'Review Concurrency Template',
        type: 'Thesis',
        createdBy: instructorId,
      })
      .returning({ id: assignmentTemplates.id });

    templateId = template.id;

    const [assignment] = await db
      .insert(assignments)
      .values({
        templateId,
        title: 'Review Concurrency Assignment',
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
        name: 'Review Concurrency Checkpoint',
        order: 1,
        state: 'unlocked',
        dueDate: new Date(Date.now() + 1000000),
      })
      .returning({ id: checkpoints.id });

    checkpointId = checkpoint.id;

    const [upload] = await db
      .insert(uploadIntents)
      .values({
        fileKey: `submissions/review-concurrency-${timestamp}.pdf`,
        userId: studentId,
        purpose: 'submission',
        checkpointId,
        fileName: 'concurrency.pdf',
        fileSize: 1024,
        contentType: 'application/pdf',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      })
      .returning({ fileKey: uploadIntents.fileKey });

    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
      user: { id: studentId, name: 'Concurrency Student', role: 'student' },
      session: {} as any,
    } as any);

    const submissionResult = await submitCheckpointHandler({
      data: {
        checkpointId,
        fileKey: upload.fileKey,
        fileName: 'concurrency.pdf',
        fileSize: 1024,
      },
    });

    expect(submissionResult).toEqual({ success: true });

    const [submission] = await db
      .select({ id: submissions.id })
      .from(submissions)
      .where(eq(submissions.checkpointId, checkpointId))
      .limit(1);

    submissionId = submission.id;
  });

  afterEach(async () => {
    await db
      .delete(notifications)
      .where(or(eq(notifications.userId, studentId), eq(notifications.userId, instructorId)));
    await db
      .delete(auditLog)
      .where(or(eq(auditLog.actorId, studentId), eq(auditLog.actorId, instructorId)));
    await db.delete(reviews).where(eq(reviews.submissionId, submissionId));
    await db.delete(uploadIntents).where(eq(uploadIntents.userId, studentId));
    await db.delete(submissions).where(eq(submissions.checkpointId, checkpointId));
    await db.delete(checkpoints).where(eq(checkpoints.id, checkpointId));
    await db.delete(assignmentStudents).where(eq(assignmentStudents.assignmentId, assignmentId));
    await db.delete(assignments).where(eq(assignments.id, assignmentId));
    await db.delete(templateCheckpoints).where(eq(templateCheckpoints.templateId, templateId));
    await db.delete(assignmentTemplates).where(eq(assignmentTemplates.id, templateId));
    await db.delete(users).where(eq(users.id, studentId));
    await db.delete(users).where(eq(users.id, instructorId));
  });

  it('only one of two concurrent submitReview calls succeeds on the same submission', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
      user: { id: instructorId, role: 'instructor', locale: 'en' },
      session: {} as any,
    } as any);

    const [resultPass, resultRevise] = await Promise.all([
      submitReviewHandler({
        data: { submissionId, decision: 'pass', comment: 'Great work!' },
      }),
      submitReviewHandler({
        data: { submissionId, decision: 'revise', comment: 'Needs work' },
      }),
    ]);

    const successes = [resultPass, resultRevise].filter(
      (r) => (r as { success?: boolean }).success === true,
    );
    const failures = [resultPass, resultRevise].filter((r) => (r as { error?: unknown }).error);

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);

    const reviewRows = await db
      .select({ id: reviews.id, decision: reviews.decision })
      .from(reviews)
      .where(eq(reviews.submissionId, submissionId));

    expect(reviewRows).toHaveLength(1);

    const [finalCheckpoint] = await db
      .select({ state: checkpoints.state })
      .from(checkpoints)
      .where(eq(checkpoints.id, checkpointId));

    const decision = reviewRows[0].decision;
    expect(finalCheckpoint.state).toBe(decision === 'pass' ? 'passed' : decision);
  });

  it('rejects a late openForReview after the submission has already been passed', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
      user: { id: instructorId, role: 'instructor', locale: 'en' },
      session: {} as any,
    } as any);

    const openResult = await openForReviewHandler({
      data: { submissionId },
    });
    expect(openResult).toEqual({ success: true });

    const reviewResult = await submitReviewHandler({
      data: { submissionId, decision: 'pass', comment: 'Well done!' },
    });
    expect(reviewResult).toEqual({ success: true });

    const lateOpenResult = await openForReviewHandler({
      data: { submissionId },
    });

    expect(lateOpenResult).toEqual({
      error: {
        code: 'BAD_REQUEST',
        message: 'Checkpoint must be in submitted state to open for review',
      },
    });

    const [finalCheckpoint] = await db
      .select({ state: checkpoints.state })
      .from(checkpoints)
      .where(eq(checkpoints.id, checkpointId));

    expect(finalCheckpoint.state).toBe('passed');
  });

  it('only one of two concurrent submitCheckpoint calls inserts a submission', async () => {
    // Remove the setup submission and its consumed intent so this test starts fresh.
    await db.delete(submissions).where(eq(submissions.checkpointId, checkpointId));
    await db.delete(uploadIntents).where(eq(uploadIntents.userId, studentId));

    await db.update(checkpoints).set({ state: 'unlocked' }).where(eq(checkpoints.id, checkpointId));

    const fileKeyA = `submissions/review-concurrency-a-${timestamp}.pdf`;
    const fileKeyB = `submissions/review-concurrency-b-${timestamp}.pdf`;

    await db.insert(uploadIntents).values([
      {
        fileKey: fileKeyA,
        userId: studentId,
        purpose: 'submission',
        checkpointId,
        fileName: 'first.pdf',
        fileSize: 1024,
        contentType: 'application/pdf',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
      {
        fileKey: fileKeyB,
        userId: studentId,
        purpose: 'submission',
        checkpointId,
        fileName: 'second.pdf',
        fileSize: 1024,
        contentType: 'application/pdf',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    ]);

    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
      user: { id: studentId, name: 'Concurrency Student', role: 'student' },
      session: {} as any,
    } as any);

    const [resultA, resultB] = await Promise.all([
      submitCheckpointHandler({
        data: { checkpointId, fileKey: fileKeyA, fileName: 'first.pdf', fileSize: 1024 },
      }),
      submitCheckpointHandler({
        data: { checkpointId, fileKey: fileKeyB, fileName: 'second.pdf', fileSize: 1024 },
      }),
    ]);

    const successes = [resultA, resultB].filter(
      (r) => (r as { success?: boolean }).success === true,
    );
    const failures = [resultA, resultB].filter((r) => (r as { error?: unknown }).error);

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);

    const submissionRows = await db
      .select({ id: submissions.id })
      .from(submissions)
      .where(eq(submissions.checkpointId, checkpointId));

    expect(submissionRows).toHaveLength(1);
  });
});
