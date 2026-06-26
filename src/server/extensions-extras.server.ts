// Server-only handlers for extension approval, rejection, and bulk extension
import { eq, and, sql, isNull } from 'drizzle-orm';
import { getDb } from '../db/index';
import { assignments, checkpoints } from '../db/schema/assignments';
import { extensionRequests } from '../db/schema/extensions';
import { notifications } from '../db/schema/notifications';
import { getSessionFromHeaders } from './auth';
import { serverError, ErrorCode } from '../lib/errors';
import { logAuditEvent } from '../lib/audit';
import { getNotificationKeys, resolveNotificationContent } from './notifications.server';
import type { NonNullableSession } from '../lib/types';
import type { z } from 'zod';
import type { ApproveExtensionSchema, RejectExtensionSchema, BulkExtendSchema } from './extensions';

type ApproveExtensionInput = z.infer<typeof ApproveExtensionSchema>;
type RejectExtensionInput = z.infer<typeof RejectExtensionSchema>;
type BulkExtendInput = z.infer<typeof BulkExtendSchema>;

function isInstructor(session: NonNullableSession | null): session is NonNullableSession {
  return !!session && session.user.role === 'instructor';
}

/**
 * Calculate and apply extension adjustment.
 * Extends the affected checkpoint's dueDate, all subsequent checkpoints,
 * and the assignment finalDeadline by the given number of days.
 */
async function calculateExtensionAdjustment(
  db: ReturnType<typeof getDb>,
  args: {
    assignmentId: number;
    studentId: string;
    checkpointId: number;
    extensionDays: number;
  },
): Promise<void> {
  const { assignmentId, studentId, checkpointId, extensionDays } = args;

  // 1. Get the target checkpoint to find its order
  const [targetCheckpoint] = await db
    .select({ order: checkpoints.order, dueDate: checkpoints.dueDate })
    .from(checkpoints)
    .where(eq(checkpoints.id, checkpointId))
    .limit(1);

  if (!targetCheckpoint) return;

  const msPerDay = 24 * 60 * 60 * 1000;

  // 2. Extend the affected checkpoint
  const newDueDate = new Date(
    (targetCheckpoint.dueDate ?? new Date()).getTime() + extensionDays * msPerDay,
  );
  await db
    .update(checkpoints)
    .set({ dueDate: newDueDate, updatedAt: new Date() })
    .where(eq(checkpoints.id, checkpointId));

  // 3. Extend all subsequent checkpoints for this student in this assignment
  const subsequentCheckpoints = await db
    .select({ id: checkpoints.id, dueDate: checkpoints.dueDate })
    .from(checkpoints)
    .where(
      and(
        eq(checkpoints.assignmentId, assignmentId),
        eq(checkpoints.studentId, studentId),
        sql`${checkpoints.order} > ${targetCheckpoint.order}`,
      ),
    );

  for (const cp of subsequentCheckpoints) {
    await db
      .update(checkpoints)
      .set({
        dueDate: new Date((cp.dueDate ?? new Date()).getTime() + extensionDays * msPerDay),
        updatedAt: new Date(),
      })
      .where(eq(checkpoints.id, cp.id));
  }

  // 4. Extend assignment finalDeadline
  const [assignment] = await db
    .select({ finalDeadline: assignments.finalDeadline })
    .from(assignments)
    .where(eq(assignments.id, assignmentId))
    .limit(1);

  if (assignment?.finalDeadline) {
    await db
      .update(assignments)
      .set({
        finalDeadline: new Date(assignment.finalDeadline.getTime() + extensionDays * msPerDay),
      })
      .where(eq(assignments.id, assignmentId));
  }
}

/**
 * Approve a pending extension request.
 * Instructor-only, ownership-guarded. Extends deadlines and notifies student.
 */
export async function approveExtensionHandler(args: { data: ApproveExtensionInput }) {
  const session = await getSessionFromHeaders();
  if (!isInstructor(session)) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const { requestId, resolutionReason } = args.data;
  const db = getDb();

  try {
    // 1. Fetch request with assignment ownership check
    const [request] = await db
      .select({
        id: extensionRequests.id,
        status: extensionRequests.status,
        extensionDays: extensionRequests.extensionDays,
        studentId: extensionRequests.studentId,
        checkpointId: extensionRequests.checkpointId,
        assignmentId: extensionRequests.assignmentId,
        instructorId: assignments.instructorId,
      })
      .from(extensionRequests)
      .innerJoin(assignments, eq(extensionRequests.assignmentId, assignments.id))
      .where(
        and(
          eq(extensionRequests.id, requestId),
          eq(assignments.instructorId, session.user.id),
          isNull(assignments.deletedAt),
        ),
      )
      .limit(1);

    if (!request) {
      return serverError(ErrorCode.NOT_FOUND, 'Extension request not found');
    }

    if (request.status !== 'pending') {
      return serverError(ErrorCode.BAD_REQUEST, 'Extension request is not in pending state');
    }

    // 2. Execute in transaction: approve request + extend deadlines
    await db.transaction(async (tx) => {
      await tx
        .update(extensionRequests)
        .set({
          status: 'approved',
          resolvedBy: session.user.id,
          resolutionReason: resolutionReason ?? null,
          resolvedAt: new Date(),
        })
        .where(eq(extensionRequests.id, requestId));

      if (request.checkpointId) {
        await calculateExtensionAdjustment(tx as ReturnType<typeof getDb>, {
          assignmentId: request.assignmentId,
          studentId: request.studentId,
          checkpointId: request.checkpointId,
          extensionDays: request.extensionDays,
        });
      }
    });

    // 3. Notify the student (outside transaction — advisory)
    const approvedParams = { extensionDays: String(request.extensionDays) };
    const approvedKeys = getNotificationKeys('extension_approved');
    const approvedContent = resolveNotificationContent(
      approvedKeys.titleKey,
      approvedKeys.messageKey,
      approvedParams,
      'en',
    );
    await db.insert(notifications).values({
      userId: request.studentId,
      type: 'extension_approved',
      title: approvedContent.title,
      message: approvedContent.message,
      titleKey: approvedKeys.titleKey,
      messageKey: approvedKeys.messageKey,
      params: approvedParams,
      channel: 'in_app',
      metadata: {
        extensionRequestId: requestId,
        assignmentId: request.assignmentId,
        extensionDays: request.extensionDays,
      },
    });

    // 4. Audit log
    await logAuditEvent({
      actorId: session.user.id,
      action: 'extension.approved',
      entityType: 'extension_request',
      entityId: String(requestId),
      details: {
        assignmentId: request.assignmentId,
        studentId: request.studentId,
        extensionDays: request.extensionDays,
        resolutionReason: resolutionReason ?? null,
      },
    });

    return { success: true };
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'approveExtensionHandler',
    });
  }
}

/**
 * Reject a pending extension request with a reason.
 * Instructor-only, ownership-guarded.
 */
export async function rejectExtensionHandler(args: { data: RejectExtensionInput }) {
  const session = await getSessionFromHeaders();
  if (!isInstructor(session)) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const { requestId, resolutionReason } = args.data;
  const db = getDb();

  try {
    // 1. Fetch request with assignment ownership check
    const [request] = await db
      .select({
        id: extensionRequests.id,
        status: extensionRequests.status,
        extensionDays: extensionRequests.extensionDays,
        studentId: extensionRequests.studentId,
        assignmentId: extensionRequests.assignmentId,
        instructorId: assignments.instructorId,
      })
      .from(extensionRequests)
      .innerJoin(assignments, eq(extensionRequests.assignmentId, assignments.id))
      .where(
        and(
          eq(extensionRequests.id, requestId),
          eq(assignments.instructorId, session.user.id),
          isNull(assignments.deletedAt),
        ),
      )
      .limit(1);

    if (!request) {
      return serverError(ErrorCode.NOT_FOUND, 'Extension request not found');
    }

    if (request.status !== 'pending') {
      return serverError(ErrorCode.BAD_REQUEST, 'Extension request is not in pending state');
    }

    // 2. Update status to rejected
    await db
      .update(extensionRequests)
      .set({
        status: 'rejected',
        resolvedBy: session.user.id,
        resolutionReason,
        resolvedAt: new Date(),
      })
      .where(eq(extensionRequests.id, requestId));

    // 3. Notify the student
    const rejectedParams = {
      extensionDays: String(request.extensionDays),
      resolutionReason,
    };
    const rejectedKeys = getNotificationKeys('extension_rejected');
    const rejectedContent = resolveNotificationContent(
      rejectedKeys.titleKey,
      rejectedKeys.messageKey,
      rejectedParams,
      'en',
    );
    await db.insert(notifications).values({
      userId: request.studentId,
      type: 'extension_rejected',
      title: rejectedContent.title,
      message: rejectedContent.message,
      titleKey: rejectedKeys.titleKey,
      messageKey: rejectedKeys.messageKey,
      params: rejectedParams,
      channel: 'in_app',
      metadata: {
        extensionRequestId: requestId,
        assignmentId: request.assignmentId,
        extensionDays: request.extensionDays,
        resolutionReason,
      },
    });

    // 4. Audit log
    await logAuditEvent({
      actorId: session.user.id,
      action: 'extension.rejected',
      entityType: 'extension_request',
      entityId: String(requestId),
      details: {
        assignmentId: request.assignmentId,
        studentId: request.studentId,
        extensionDays: request.extensionDays,
        resolutionReason,
      },
    });

    return { success: true };
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'rejectExtensionHandler',
    });
  }
}

/**
 * Bulk extend all unfinished checkpoints for a student by N days.
 * Instructor-only, ownership-guarded.
 */
export async function bulkExtendHandler(args: { data: BulkExtendInput }) {
  const session = await getSessionFromHeaders();
  if (!isInstructor(session)) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const { assignmentId, studentId, extraDays, reason } = args.data;
  const db = getDb();

  try {
    // 1. Verify ownership
    const [assignment] = await db
      .select({ id: assignments.id })
      .from(assignments)
      .where(
        and(
          eq(assignments.id, assignmentId),
          eq(assignments.instructorId, session.user.id),
          isNull(assignments.deletedAt),
        ),
      )
      .limit(1);

    if (!assignment) {
      return serverError(ErrorCode.NOT_FOUND, 'Assignment not found');
    }

    // 2. Find all unfinished checkpoints for this student
    const unfinishedCheckpoints = await db
      .select({ id: checkpoints.id, dueDate: checkpoints.dueDate, name: checkpoints.name })
      .from(checkpoints)
      .where(
        and(
          eq(checkpoints.assignmentId, assignmentId),
          eq(checkpoints.studentId, studentId),
          sql`${checkpoints.state} != 'passed'`,
        ),
      )
      .orderBy(checkpoints.order);

    if (unfinishedCheckpoints.length === 0) {
      return serverError(ErrorCode.BAD_REQUEST, 'No unfinished checkpoints found for this student');
    }

    const msPerDay = 24 * 60 * 60 * 1000;

    // 3. Execute in transaction
    await db.transaction(async (tx) => {
      for (const cp of unfinishedCheckpoints) {
        await tx
          .update(checkpoints)
          .set({
            dueDate: new Date((cp.dueDate ?? new Date()).getTime() + extraDays * msPerDay),
            updatedAt: new Date(),
          })
          .where(eq(checkpoints.id, cp.id));
      }

      // 4. Also extend assignment finalDeadline
      const [assignmentRecord] = await tx
        .select({ finalDeadline: assignments.finalDeadline })
        .from(assignments)
        .where(eq(assignments.id, assignmentId))
        .limit(1);

      if (assignmentRecord?.finalDeadline) {
        await tx
          .update(assignments)
          .set({
            finalDeadline: new Date(
              assignmentRecord.finalDeadline.getTime() + extraDays * msPerDay,
            ),
          })
          .where(eq(assignments.id, assignmentId));
      }
    });

    // 5. Log per-extension audit events (outside transaction)
    for (const cp of unfinishedCheckpoints) {
      await logAuditEvent({
        actorId: session.user.id,
        action: 'deadline.extended',
        entityType: 'checkpoint',
        entityId: String(cp.id),
        details: {
          assignmentId,
          studentId,
          extraDays,
          checkpointName: cp.name,
          reason,
        },
      });
    }

    // 6. Notify the student
    const extendedParams = {
      extraDays: String(extraDays),
      checkpointCount: String(unfinishedCheckpoints.length),
      reason,
    };
    const extendedKeys = getNotificationKeys('deadline_extended');
    const extendedContent = resolveNotificationContent(
      extendedKeys.titleKey,
      extendedKeys.messageKey,
      extendedParams,
      'en',
    );
    await db.insert(notifications).values({
      userId: studentId,
      type: 'deadline_extended',
      title: extendedContent.title,
      message: extendedContent.message,
      titleKey: extendedKeys.titleKey,
      messageKey: extendedKeys.messageKey,
      params: extendedParams,
      channel: 'in_app',
      metadata: {
        assignmentId,
        extraDays,
        checkpointCount: unfinishedCheckpoints.length,
        checkpointIds: unfinishedCheckpoints.map((cp) => cp.id),
        reason,
      },
    });

    return { success: true, extendedCount: unfinishedCheckpoints.length };
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'bulkExtendHandler',
    });
  }
}
