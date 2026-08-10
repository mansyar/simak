// Server-only handlers for instructor intervention management.
import { and, desc, eq, inArray, isNull, lt, sql } from 'drizzle-orm';
import type { Db } from '@/db';
import { getDb } from '@/db';
import { assignments, assignmentStudents } from '@/db/schema/assignments';
import { interventions } from '@/db/schema/interventions';
import { users } from '@/db/schema/users';
import { safeAuditLog } from '@/lib/audit';
import { ErrorCode, isServerError, serverError } from '@/lib/errors';
import { isInstructor } from '@/lib/session-guards';
import { getSessionFromHeaders } from '@/server/auth';
import { captureLifecycleRiskObservation } from '@/server/lifecycle-risk-capture.server';
import { getLiveStudentRiskContexts } from '@/server/student-risk-context.server';
import type {
  CreateInterventionSchema,
  GetInterventionContextSchema,
  ListInterventionsSchema,
  UpdateInterventionSchema,
} from './interventions';
import type { z } from 'zod';

type CreateInterventionInput = z.infer<typeof CreateInterventionSchema>;
type ListInterventionsInput = z.infer<typeof ListInterventionsSchema>;
type GetInterventionContextInput = z.infer<typeof GetInterventionContextSchema>;
type UpdateInterventionInput = z.infer<typeof UpdateInterventionSchema>;
type Transaction = Parameters<Parameters<Db['transaction']>[0]>[0];
type QueryDb = Db | Transaction;

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === '23505'
  );
}

async function lockOwnedAssignment(db: QueryDb, assignmentId: number, instructorId: string) {
  return db
    .select({ id: assignments.id })
    .from(assignments)
    .where(
      and(
        eq(assignments.id, assignmentId),
        eq(assignments.instructorId, instructorId),
        eq(assignments.status, 'active'),
        isNull(assignments.deletedAt),
      ),
    )
    .limit(1)
    .for('update', { of: assignments });
}

async function lockAssignmentStudent(db: QueryDb, assignmentId: number, studentId: string) {
  return db
    .select({ id: assignmentStudents.id })
    .from(assignmentStudents)
    .where(
      and(
        eq(assignmentStudents.assignmentId, assignmentId),
        eq(assignmentStudents.studentId, studentId),
      ),
    )
    .limit(1)
    .for('update', { of: assignmentStudents });
}

async function lockOwnedIntervention(db: QueryDb, interventionId: number, instructorId: string) {
  return (
    db
      .select({
        id: interventions.id,
        assignmentId: interventions.assignmentId,
        studentId: interventions.studentId,
        actionType: interventions.actionType,
        privateNote: interventions.privateNote,
        status: interventions.status,
        followUpDate: interventions.followUpDate,
        resolutionReason: interventions.resolutionReason,
      })
      .from(interventions)
      .innerJoin(assignments, eq(interventions.assignmentId, assignments.id))
      .where(
        and(
          eq(interventions.id, interventionId),
          eq(assignments.instructorId, instructorId),
          eq(assignments.status, 'active'),
          isNull(assignments.deletedAt),
        ),
      )
      .limit(1)
      // Lock the joined assignment together with the intervention so an
      // assignment reassignment cannot commit between the ownership check and update.
      .for('update')
  );
}

function hasStudentInactionRisk(
  context: Awaited<ReturnType<typeof getLiveStudentRiskContexts>>[number],
) {
  return context.assessment.factors.some((factor) => factor.category === 'student_inaction');
}

export async function createInterventionHandler(args: { data: CreateInterventionInput }) {
  const session = await getSessionFromHeaders();
  if (!isInstructor(session)) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const { assignmentId, studentId, actionType, privateNote, followUpDate } = args.data;
  const db = getDb();

  try {
    const result = await db.transaction(async (tx) => {
      const [assignment] = await lockOwnedAssignment(tx, assignmentId, session.user.id);
      if (!assignment) {
        return serverError(ErrorCode.NOT_FOUND, 'Assignment or student not found');
      }

      const [enrollment] = await lockAssignmentStudent(tx, assignmentId, studentId);
      if (!enrollment) {
        return serverError(ErrorCode.NOT_FOUND, 'Assignment or student not found');
      }

      const [context] = await getLiveStudentRiskContexts(tx as Db, {
        assignmentIds: [assignmentId],
        studentId,
      });
      if (!context || !hasStudentInactionRisk(context)) {
        return serverError(
          ErrorCode.BAD_REQUEST,
          'An intervention requires a live student-inaction risk factor',
        );
      }

      try {
        const [intervention] = await tx
          .insert(interventions)
          .values({
            assignmentId,
            studentId,
            actionType,
            privateNote: privateNote ?? null,
            followUpDate: followUpDate ?? null,
          })
          .returning();

        return { intervention };
      } catch (error) {
        if (isUniqueViolation(error)) {
          return serverError(
            ErrorCode.CONFLICT,
            'An active intervention already exists for this student',
          );
        }
        throw error;
      }
    });

    if (isServerError(result)) return result;

    await captureLifecycleRiskObservation(db, 'createInterventionHandler', {
      source: 'lifecycle_event',
      eventType: 'intervention_updated',
      sourceEventId: `intervention:${result.intervention.id}:created`,
      assignmentId: result.intervention.assignmentId,
      studentId: result.intervention.studentId,
      interventionId: result.intervention.id,
      actorId: session.user.id,
      observedAt: result.intervention.createdAt,
    });

    await safeAuditLog('intervention.created', {
      actorId: session.user.id,
      action: 'intervention.created',
      entityType: 'intervention',
      entityId: String(result.intervention.id),
      details: {
        assignmentId,
        studentId,
        actionType,
        followUpDate: followUpDate?.toISOString() ?? null,
      },
    });

    return result;
  } catch (error) {
    if (isUniqueViolation(error)) {
      return serverError(
        ErrorCode.CONFLICT,
        'An active intervention already exists for this student',
      );
    }
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: error instanceof Error ? error.message : String(error),
      handler: 'createInterventionHandler',
    });
  }
}

export async function listInterventionsHandler(args: { data: ListInterventionsInput }) {
  const session = await getSessionFromHeaders();
  if (!isInstructor(session)) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const { assignmentId, studentId, status, overdue, page, limit } = args.data;
  const db = getDb();
  const conditions = [
    eq(assignments.instructorId, session.user.id),
    eq(assignments.status, 'active'),
    isNull(assignments.deletedAt),
  ];

  if (assignmentId !== undefined) conditions.push(eq(interventions.assignmentId, assignmentId));
  if (studentId !== undefined) conditions.push(eq(interventions.studentId, studentId));
  if (status !== undefined) conditions.push(eq(interventions.status, status));
  if (overdue) {
    conditions.push(lt(interventions.followUpDate, new Date()));
    conditions.push(inArray(interventions.status, ['open', 'monitoring']));
  }

  try {
    const query = db
      .select({
        id: interventions.id,
        assignmentId: interventions.assignmentId,
        studentId: interventions.studentId,
        actionType: interventions.actionType,
        privateNote: interventions.privateNote,
        status: interventions.status,
        followUpDate: interventions.followUpDate,
        resolutionReason: interventions.resolutionReason,
        createdAt: interventions.createdAt,
        updatedAt: interventions.updatedAt,
        assignmentTitle: assignments.title,
        studentName: users.name,
      })
      .from(interventions)
      .innerJoin(assignments, eq(interventions.assignmentId, assignments.id))
      .innerJoin(users, eq(interventions.studentId, users.id))
      .where(and(...conditions))
      .orderBy(desc(interventions.createdAt))
      .limit(limit)
      .offset((page - 1) * limit);

    const countQuery = db
      .select({ count: sql<number>`count(*)::int` })
      .from(interventions)
      .innerJoin(assignments, eq(interventions.assignmentId, assignments.id))
      .where(and(...conditions));

    const [interventionRows, [{ count }]] = await Promise.all([query, countQuery]);
    return { interventions: interventionRows, total: Number(count), page, limit };
  } catch (error) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: error instanceof Error ? error.message : String(error),
      handler: 'listInterventionsHandler',
    });
  }
}

export async function getInterventionContextHandler(args: { data: GetInterventionContextInput }) {
  const session = await getSessionFromHeaders();
  if (!isInstructor(session)) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const { assignmentId, studentId } = args.data;
  const db = getDb();

  try {
    const [assignment] = await lockOwnedAssignment(db, assignmentId, session.user.id);
    if (!assignment) {
      return serverError(ErrorCode.NOT_FOUND, 'Assignment or student not found');
    }

    const [enrollment] = await lockAssignmentStudent(db, assignmentId, studentId);
    if (!enrollment) {
      return serverError(ErrorCode.NOT_FOUND, 'Assignment or student not found');
    }

    const [context] = await getLiveStudentRiskContexts(db, {
      assignmentIds: [assignmentId],
      studentId,
    });
    if (!context) {
      return serverError(ErrorCode.NOT_FOUND, 'Live risk context not found');
    }

    return { context };
  } catch (error) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: error instanceof Error ? error.message : String(error),
      handler: 'getInterventionContextHandler',
    });
  }
}

function isAllowedStatusTransition(
  currentStatus: (typeof interventions.$inferSelect)['status'],
  nextStatus: NonNullable<UpdateInterventionInput['status']>,
) {
  if (currentStatus === 'resolved' || currentStatus === 'dismissed') return false;
  if (currentStatus === nextStatus) return false;

  if (currentStatus === 'open') {
    return nextStatus === 'monitoring' || nextStatus === 'resolved' || nextStatus === 'dismissed';
  }

  return nextStatus === 'open' || nextStatus === 'resolved' || nextStatus === 'dismissed';
}

export async function updateInterventionHandler(args: { data: UpdateInterventionInput }) {
  const session = await getSessionFromHeaders();
  if (!isInstructor(session)) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const { interventionId, actionType, privateNote, followUpDate, status, resolutionReason } =
    args.data;
  const db = getDb();
  const committedUpdatedAt = new Date();

  try {
    const result = await db.transaction(async (tx) => {
      const [existing] = await lockOwnedIntervention(tx, interventionId, session.user.id);
      if (!existing) {
        return serverError(ErrorCode.NOT_FOUND, 'Intervention not found');
      }

      if (existing.status === 'resolved' || existing.status === 'dismissed') {
        return serverError(
          ErrorCode.BAD_REQUEST,
          'Resolved and dismissed interventions are immutable',
        );
      }

      if (status !== undefined) {
        if (!isAllowedStatusTransition(existing.status, status)) {
          return serverError(ErrorCode.BAD_REQUEST, 'Invalid intervention status transition');
        }

        if ((status === 'resolved' || status === 'dismissed') && !resolutionReason?.trim()) {
          return serverError(ErrorCode.BAD_REQUEST, 'A resolution or dismissal reason is required');
        }
      }

      const changedFields: string[] = [];
      const values: Partial<typeof interventions.$inferInsert> = { updatedAt: committedUpdatedAt };

      if (actionType !== undefined) {
        values.actionType = actionType;
        changedFields.push('actionType');
      }
      if (privateNote !== undefined) {
        values.privateNote = privateNote;
        changedFields.push('privateNote');
      }
      if (followUpDate !== undefined) {
        values.followUpDate = followUpDate;
        changedFields.push('followUpDate');
      }
      if (status !== undefined) {
        values.status = status;
        changedFields.push('status');
      }
      if (resolutionReason !== undefined) {
        values.resolutionReason = resolutionReason;
        changedFields.push('resolutionReason');
      }

      const [intervention] = await tx
        .update(interventions)
        .set(values)
        .where(eq(interventions.id, interventionId))
        .returning();

      if (!intervention) {
        return serverError(ErrorCode.NOT_FOUND, 'Intervention not found');
      }

      return { intervention, previousStatus: existing.status, changedFields };
    });

    if (isServerError(result)) return result;

    await captureLifecycleRiskObservation(db, 'updateInterventionHandler', {
      source: 'lifecycle_event',
      eventType: 'intervention_updated',
      sourceEventId: `intervention:${result.intervention.id}:updated:${committedUpdatedAt.toISOString()}`,
      assignmentId: result.intervention.assignmentId,
      studentId: result.intervention.studentId,
      interventionId: result.intervention.id,
      actorId: session.user.id,
      observedAt: committedUpdatedAt,
    });

    const auditAction =
      result.intervention.status === 'resolved' || result.intervention.status === 'dismissed'
        ? `intervention.${result.intervention.status}`
        : 'intervention.updated';
    await safeAuditLog(auditAction, {
      actorId: session.user.id,
      action: auditAction,
      entityType: 'intervention',
      entityId: String(result.intervention.id),
      details: {
        previousStatus: result.previousStatus,
        status: result.intervention.status,
        changedFields: result.changedFields,
        ...(result.intervention.status === 'resolved' || result.intervention.status === 'dismissed'
          ? { reason: resolutionReason ?? result.intervention.resolutionReason }
          : {}),
      },
    });

    return { intervention: result.intervention };
  } catch (error) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: error instanceof Error ? error.message : String(error),
      handler: 'updateInterventionHandler',
    });
  }
}
