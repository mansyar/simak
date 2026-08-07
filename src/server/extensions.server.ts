// Server-only handlers for extension request operations
import { eq, and, asc, desc, sql, inArray, isNull } from 'drizzle-orm';
import { getDb } from '../db/index';
import { assignments, assignmentStudents, checkpoints } from '../db/schema/assignments';
import { extensionRequests } from '../db/schema/extensions';
import { notifications } from '../db/schema/notifications';
import { users } from '../db/schema/users';
import { getSessionFromHeaders } from './auth';
import { serverError, ErrorCode, isServerError } from '../lib/errors';
import { getNotificationKeys } from './notifications.server';
import { sendExtensionRequestedEmail } from '../lib/extension-email';
import { shouldSendInAppNotification } from '../lib/notification-prefs';
import { isInstructor, isStudent } from '../lib/session-guards';
import type { z } from 'zod';
import type {
  RequestExtensionSchema,
  ListExtensionRequestsSchema,
  ListMyExtensionsSchema,
} from './extensions';

type RequestExtensionInput = z.infer<typeof RequestExtensionSchema>;
type ListExtensionRequestsInput = z.infer<typeof ListExtensionRequestsSchema>;
type ListMyExtensionsInput = z.infer<typeof ListMyExtensionsSchema>;

/**
 * Find the current active checkpoint for a student in an assignment.
 * Returns the first non-passed checkpoint (ordered by order asc).
 */
async function findActiveCheckpoint(
  db: ReturnType<typeof getDb>,
  assignmentId: number,
  studentId: string,
): Promise<{ id: number; dueDate: Date | null; order: number } | null> {
  const active = await db
    .select({ id: checkpoints.id, dueDate: checkpoints.dueDate, order: checkpoints.order })
    .from(checkpoints)
    .where(
      and(
        eq(checkpoints.assignmentId, assignmentId),
        eq(checkpoints.studentId, studentId),
        sql`${checkpoints.state} != 'passed'`,
      ),
    )
    .orderBy(checkpoints.order)
    .limit(1);

  return active[0] ?? null;
}

/**
 * Count approved + pending extension requests for a student in an assignment.
 */
async function countActiveExtensionRequests(
  db: ReturnType<typeof getDb>,
  assignmentId: number,
  studentId: string,
): Promise<number> {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(extensionRequests)
    .where(
      and(
        eq(extensionRequests.assignmentId, assignmentId),
        eq(extensionRequests.studentId, studentId),
        inArray(extensionRequests.status, ['pending', 'approved']),
      ),
    );
  return Number(count);
}

/**
 * Request a deadline extension.
 * Student-only. Validates extension caps and creates a pending request.
 */
export async function requestExtensionHandler(args: { data: RequestExtensionInput }) {
  const session = await getSessionFromHeaders();
  if (!isStudent(session)) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const { assignmentId, checkpointId, category, reason, extensionDays } = args.data;
  const db = getDb();

  try {
    // 1. Verify student is assigned to this assignment
    const [enrollment] = await db
      .select({ id: assignmentStudents.id })
      .from(assignmentStudents)
      .where(
        and(
          eq(assignmentStudents.assignmentId, assignmentId),
          eq(assignmentStudents.studentId, session.user.id),
        ),
      )
      .limit(1);

    if (!enrollment) {
      return serverError(ErrorCode.NOT_FOUND, 'Assignment not found');
    }

    // 2. Fetch assignment caps and instructor
    const [assignment] = await db
      .select({
        maxExtensionDays: assignments.maxExtensionDays,
        maxTotalExtensions: assignments.maxTotalExtensions,
        instructorId: assignments.instructorId,
      })
      .from(assignments)
      .where(
        and(
          eq(assignments.id, assignmentId),
          eq(assignments.status, 'active'),
          isNull(assignments.deletedAt),
        ),
      )
      .limit(1);

    if (!assignment) {
      return serverError(ErrorCode.NOT_FOUND, 'Assignment not found');
    }

    const maxDays = assignment.maxExtensionDays ?? 7;
    const maxExtensions = assignment.maxTotalExtensions ?? 3;

    // 3. Validate extension days against assignment cap
    if (extensionDays > maxDays) {
      return serverError(
        ErrorCode.BAD_REQUEST,
        `Extension days cannot exceed ${maxDays} for this assignment`,
      );
    }

    // 4. Resolve checkpoint: use provided or find active
    let targetCheckpointId = checkpointId;
    if (!targetCheckpointId) {
      const active = await findActiveCheckpoint(db, assignmentId, session.user.id);
      if (!active) {
        return serverError(ErrorCode.BAD_REQUEST, 'No active checkpoint found to extend');
      }
      targetCheckpointId = active.id;
    }

    // 5. Get checkpoint info for requestedDeadline calculation
    const [targetCp] = await db
      .select({ dueDate: checkpoints.dueDate })
      .from(checkpoints)
      .where(
        and(
          eq(checkpoints.id, targetCheckpointId),
          eq(checkpoints.studentId, session.user.id),
          eq(checkpoints.assignmentId, assignmentId),
        ),
      )
      .limit(1);

    if (!targetCp) {
      return serverError(ErrorCode.NOT_FOUND, 'Checkpoint not found');
    }

    const result = await db.transaction(async (tx) => {
      // 6. Lock enrollment row to serialize concurrent extension requests
      await tx
        .select({ id: assignmentStudents.id })
        .from(assignmentStudents)
        .where(
          and(
            eq(assignmentStudents.assignmentId, assignmentId),
            eq(assignmentStudents.studentId, session.user.id),
          ),
        )
        .for('update', { of: assignmentStudents })
        .limit(1);

      // 7. Validate total extension count cap inside transaction (under lock)
      const activeCount = await countActiveExtensionRequests(tx, assignmentId, session.user.id);
      if (activeCount >= maxExtensions) {
        return serverError(
          ErrorCode.BAD_REQUEST,
          `Maximum ${maxExtensions} extension(s) allowed for this assignment. You have used ${activeCount}.`,
        );
      }

      const requestedDeadline = new Date(
        (targetCp.dueDate ?? new Date()).getTime() + extensionDays * 24 * 60 * 60 * 1000,
      );

      // 8. Create extension request
      const [request] = await tx
        .insert(extensionRequests)
        .values({
          assignmentId,
          studentId: session.user.id,
          checkpointId: targetCheckpointId,
          category,
          reason,
          extensionDays,
          requestedDeadline,
          status: 'pending',
        })
        .returning({ id: extensionRequests.id });

      // 9. Notify the instructor
      const requestedParams = { extensionDays: String(extensionDays) };
      const requestedKeys = getNotificationKeys('extension_requested');
      const [instructorSettings] = await tx
        .select({ settings: users.settings })
        .from(users)
        .where(eq(users.id, assignment.instructorId))
        .limit(1);
      if (shouldSendInAppNotification(instructorSettings?.settings, 'extension_requested')) {
        await tx.insert(notifications).values({
          userId: assignment.instructorId,
          type: 'extension_requested',
          titleKey: requestedKeys.titleKey,
          messageKey: requestedKeys.messageKey,
          params: requestedParams,
          channel: 'in_app',
          metadata: {
            extensionRequestId: request.id,
            assignmentId,
            checkpointId: targetCheckpointId,
            extensionDays,
            category,
          },
        });
      }

      return { extensionRequest: { id: request.id } };
    });

    if (!isServerError(result)) {
      await sendExtensionRequestedEmail({
        instructorId: assignment.instructorId,
        studentName: session.user.name,
        assignmentId,
        category,
        durationRequested: extensionDays,
      });
    }

    return result;
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'requestExtensionHandler',
    });
  }
}

/**
 * List extension requests for an assignment with optional status filter.
 * Instructor-only, ownership-guarded.
 */
export async function listExtensionRequestsHandler(args: { data: ListExtensionRequestsInput }) {
  const session = await getSessionFromHeaders();
  if (!isInstructor(session)) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const { assignmentId, status, page, limit } = args.data;
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

    // 2. Build conditions
    const conditions = [eq(extensionRequests.assignmentId, assignmentId)];
    if (status) {
      conditions.push(eq(extensionRequests.status, status));
    }

    // 3. Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(extensionRequests)
      .where(and(...conditions));

    // 4. Fetch paginated results with student info
    const items = await db
      .select({
        id: extensionRequests.id,
        assignmentId: extensionRequests.assignmentId,
        studentId: extensionRequests.studentId,
        studentName: users.name,
        checkpointId: extensionRequests.checkpointId,
        checkpointName: checkpoints.name,
        requestedDeadline: extensionRequests.requestedDeadline,
        reason: extensionRequests.reason,
        category: extensionRequests.category,
        extensionDays: extensionRequests.extensionDays,
        status: extensionRequests.status,
        createdAt: extensionRequests.createdAt,
      })
      .from(extensionRequests)
      .innerJoin(users, eq(extensionRequests.studentId, users.id))
      .leftJoin(checkpoints, eq(extensionRequests.checkpointId, checkpoints.id))
      .where(and(...conditions))
      .orderBy(asc(extensionRequests.createdAt))
      .limit(limit)
      .offset((page - 1) * limit);

    return { items, total: Number(count) };
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'listExtensionRequestsHandler',
    });
  }
}

/** List extension requests for a student's own assignment. Student-only. */
export async function listMyExtensionRequestsHandler(args: { data: ListMyExtensionsInput }) {
  const session = await getSessionFromHeaders();
  if (!isStudent(session)) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const { assignmentId, page = 1, limit = 20 } = args.data;
  const db = getDb();

  try {
    // Verify enrollment
    const [enrollment] = await db
      .select({ id: assignmentStudents.id })
      .from(assignmentStudents)
      .where(
        and(
          eq(assignmentStudents.assignmentId, assignmentId),
          eq(assignmentStudents.studentId, session.user.id),
        ),
      )
      .limit(1);

    if (!enrollment) {
      return serverError(ErrorCode.NOT_FOUND, 'Assignment not found');
    }

    const conditions = and(
      eq(extensionRequests.assignmentId, assignmentId),
      eq(extensionRequests.studentId, session.user.id),
    );

    const [items, [{ count }]] = await Promise.all([
      db
        .select({
          id: extensionRequests.id,
          checkpointId: extensionRequests.checkpointId,
          checkpointName: checkpoints.name,
          requestedDeadline: extensionRequests.requestedDeadline,
          reason: extensionRequests.reason,
          category: extensionRequests.category,
          extensionDays: extensionRequests.extensionDays,
          status: extensionRequests.status,
          resolutionReason: extensionRequests.resolutionReason,
          createdAt: extensionRequests.createdAt,
          resolvedAt: extensionRequests.resolvedAt,
        })
        .from(extensionRequests)
        .leftJoin(checkpoints, eq(extensionRequests.checkpointId, checkpoints.id))
        .where(conditions)
        .orderBy(desc(extensionRequests.createdAt))
        .limit(limit)
        .offset((page - 1) * limit),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(extensionRequests)
        .where(conditions),
    ]);

    return { items, total: Number(count) };
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'listMyExtensionRequestsHandler',
    });
  }
}

// Re-export extras to keep stubs resolving from ./extensions.server
export {
  approveExtensionHandler,
  rejectExtensionHandler,
  bulkExtendHandler,
} from './extensions-extras.server';
