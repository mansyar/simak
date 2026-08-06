import { and, eq, inArray, isNull, notInArray } from 'drizzle-orm';
import { getDb } from '../db/index';
import { academicTerms, courseSections, sectionEnrollments } from '../db/schema/academic-context';
import { assignments, assignmentStudents, checkpoints } from '../db/schema/assignments';
import { assignmentGradeConfig } from '../db/schema/gradebook';
import { templateCheckpoints } from '../db/schema/templates';
import { users } from '../db/schema/users';
import { safeAuditLog } from '../lib/audit';
import { ErrorCode, serverError } from '../lib/errors';
import { isInstructor } from '../lib/session-guards';
import { getSessionFromHeaders } from './auth';
import { calculateDueDates, validateDueDates } from './due-dates.server';
import type { CloneAssignmentSchema } from './assignments';
import type { z } from 'zod';

type CloneAssignmentInput = z.infer<typeof CloneAssignmentSchema>;
type CloneAction = 'cloned' | 'rolled_over';

function invalidSourceMessage(action: CloneAction) {
  return action === 'cloned'
    ? 'Only active or archived assignments can be cloned'
    : 'Only active or archived assignments can be rolled over';
}

async function createIndependentAssignment(
  input: { data: CloneAssignmentInput },
  action: CloneAction,
) {
  const session = await getSessionFromHeaders();
  if (!isInstructor(session)) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const { sourceAssignmentId, targetSectionId, title, description, finalDeadline } = input.data;
  const requestedInputStudentIds = input.data.studentIds ?? [];
  const requestedStudentIds = [...new Set(requestedInputStudentIds)];

  if (requestedStudentIds.length !== requestedInputStudentIds.length) {
    return serverError(ErrorCode.BAD_REQUEST, 'Student selection contains duplicates');
  }
  if (finalDeadline <= new Date()) {
    return serverError(ErrorCode.BAD_REQUEST, 'Final deadline must be in the future');
  }

  const db = getDb();

  try {
    const result = await db.transaction(async (tx) => {
      const [source] = await tx
        .select({
          id: assignments.id,
          templateId: assignments.templateId,
          title: assignments.title,
          description: assignments.description,
          sectionId: assignments.sectionId,
          mode: assignments.mode,
          status: assignments.status,
          maxExtensionDays: assignments.maxExtensionDays,
          maxTotalExtensions: assignments.maxTotalExtensions,
          deletedAt: assignments.deletedAt,
        })
        .from(assignments)
        .where(
          and(
            eq(assignments.id, sourceAssignmentId),
            eq(assignments.instructorId, session.user.id),
            isNull(assignments.deletedAt),
          ),
        )
        .limit(1)
        .for('update', { of: assignments });

      if (!source || source.deletedAt) {
        return serverError(ErrorCode.FORBIDDEN, 'Source assignment is not authorized');
      }
      if (source.status === 'draft') {
        return serverError(ErrorCode.CONFLICT, invalidSourceMessage(action));
      }
      if (source.mode !== 'individual') {
        return serverError(ErrorCode.BAD_REQUEST, 'Group assignments are not supported');
      }

      const [targetSection] = await tx
        .select({
          id: courseSections.id,
          termStatus: academicTerms.status,
          sectionStatus: courseSections.status,
        })
        .from(courseSections)
        .innerJoin(academicTerms, eq(courseSections.termId, academicTerms.id))
        .innerJoin(
          sectionEnrollments,
          and(
            eq(sectionEnrollments.sectionId, courseSections.id),
            eq(sectionEnrollments.userId, session.user.id),
            eq(sectionEnrollments.role, 'instructor'),
            eq(sectionEnrollments.isActive, true),
          ),
        )
        .where(
          and(
            eq(courseSections.id, targetSectionId),
            eq(courseSections.status, 'active'),
            notInArray(academicTerms.status, ['closed', 'archived']),
          ),
        )
        .limit(1)
        .for('update', { of: courseSections });

      if (!targetSection || targetSection.sectionStatus !== 'active') {
        return serverError(ErrorCode.FORBIDDEN, 'Target section is not authorized');
      }
      if (targetSection.termStatus === 'closed' || targetSection.termStatus === 'archived') {
        return serverError(ErrorCode.BAD_REQUEST, 'Target academic term is not available');
      }

      if (requestedStudentIds.length > 0) {
        const activeStudents = await tx
          .select({ id: users.id })
          .from(sectionEnrollments)
          .innerJoin(users, eq(sectionEnrollments.userId, users.id))
          .where(
            and(
              eq(sectionEnrollments.sectionId, targetSectionId),
              eq(sectionEnrollments.role, 'student'),
              eq(sectionEnrollments.isActive, true),
              inArray(sectionEnrollments.userId, requestedStudentIds),
              eq(users.role, 'student'),
              isNull(users.deletedAt),
            ),
          );

        if (activeStudents.length !== requestedStudentIds.length) {
          return serverError(
            ErrorCode.BAD_REQUEST,
            'One or more students are not active in the target section',
          );
        }
      }

      const templateRows = await tx
        .select({
          id: templateCheckpoints.id,
          name: templateCheckpoints.name,
          order: templateCheckpoints.order,
          minConsultations: templateCheckpoints.minConsultations,
          estimatedDuration: templateCheckpoints.estimatedDuration,
        })
        .from(templateCheckpoints)
        .where(eq(templateCheckpoints.templateId, source.templateId))
        .orderBy(templateCheckpoints.order);

      const checkpointDueDates = calculateDueDates(templateRows, new Date());
      const dueDateValidation = validateDueDates(checkpointDueDates, finalDeadline);
      if (!dueDateValidation.valid) {
        throw new Error(dueDateValidation.error);
      }

      const [sourceGradeConfig] = await tx
        .select({
          gradingScheme: assignmentGradeConfig.gradingScheme,
          customWeights: assignmentGradeConfig.customWeights,
          letterGradeBounds: assignmentGradeConfig.letterGradeBounds,
        })
        .from(assignmentGradeConfig)
        .where(eq(assignmentGradeConfig.assignmentId, source.id))
        .limit(1);

      const [target] = await tx
        .insert(assignments)
        .values({
          templateId: source.templateId,
          sectionId: targetSectionId,
          title: title ?? source.title,
          description: description === undefined ? source.description : description,
          finalDeadline,
          instructorId: session.user.id,
          mode: 'individual',
          status: 'draft',
          maxExtensionDays: source.maxExtensionDays,
          maxTotalExtensions: source.maxTotalExtensions,
        })
        .returning({ id: assignments.id });

      if (requestedStudentIds.length > 0) {
        await tx
          .insert(assignmentStudents)
          .values(requestedStudentIds.map((studentId) => ({ assignmentId: target.id, studentId })));
      }

      if (requestedStudentIds.length > 0 && templateRows.length > 0) {
        const checkpointRows = requestedStudentIds.flatMap((studentId) =>
          templateRows.map((templateRow) => ({
            assignmentId: target.id,
            studentId,
            name: templateRow.name,
            order: templateRow.order,
            dueDate: checkpointDueDates.get(templateRow.order) ?? finalDeadline,
            minConsultations: templateRow.minConsultations ?? 0,
            state: templateRow.order === 1 ? ('unlocked' as const) : ('locked' as const),
            templateCheckpointId: templateRow.id,
          })),
        );
        await tx.insert(checkpoints).values(checkpointRows);
      }

      await tx.insert(assignmentGradeConfig).values({
        assignmentId: target.id,
        gradingScheme: sourceGradeConfig?.gradingScheme ?? 'equal_weight',
        customWeights: sourceGradeConfig?.customWeights ?? null,
        letterGradeBounds: sourceGradeConfig?.letterGradeBounds ?? {
          A: 90,
          B: 80,
          C: 70,
          D: 60,
        },
        releaseStatus: 'draft',
        activeReleaseVersion: null,
        publishedAt: null,
      });

      return {
        success: true as const,
        assignmentId: target.id,
        sourceAssignmentId: source.id,
        status: 'draft' as const,
        mode: 'individual' as const,
      };
    });

    if ('error' in result) return result;

    await safeAuditLog(`assignment.${action}`, {
      actorId: session.user.id,
      action: `assignment.${action}`,
      entityType: 'assignment',
      entityId: String(result.assignmentId),
      details: {
        sourceAssignmentId: result.sourceAssignmentId,
        targetAssignmentId: result.assignmentId,
        targetSectionId,
        studentCount: requestedStudentIds.length,
      },
    });

    return result;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Checkpoint')) {
      return serverError(ErrorCode.BAD_REQUEST, error.message);
    }
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: error instanceof Error ? error.message : String(error),
      handler: `assignment${action === 'cloned' ? 'Clone' : 'Rollover'}Handler`,
    });
  }
}

export async function cloneAssignmentHandler(input: { data: CloneAssignmentInput }) {
  return createIndependentAssignment(input, 'cloned');
}

export async function rolloverAssignmentHandler(input: { data: CloneAssignmentInput }) {
  return createIndependentAssignment(input, 'rolled_over');
}
