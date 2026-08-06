// Server-only handlers (not imported by client code)
import { eq } from 'drizzle-orm';
import { getDb } from '../db/index';
import { assignments, assignmentStudents, checkpoints } from '../db/schema/assignments';
import { templateCheckpoints } from '../db/schema/templates';
import { getSessionFromHeaders } from './auth';
import { logAuditEvent } from '../lib/audit';
import { serverError, ErrorCode } from '../lib/errors';
import { translateKey } from '../lib/i18n-server';
import { calculateDueDates, validateDueDates } from './due-dates.server';
import { createDefaultGradeConfig } from './assignments-extras.server';
import { isInstructor } from '../lib/session-guards';
import {
  getActiveSectionStudentIds,
  getAuthorizedInstructorSection,
} from './assignments-context.server';
import type { z } from 'zod';
import type { CreateAssignmentSchema } from './assignments';

type CreateAssignmentInput = z.infer<typeof CreateAssignmentSchema>;

export async function createAssignmentHandler(args: { data: CreateAssignmentInput }) {
  const session = await getSessionFromHeaders();
  if (!isInstructor(session)) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const {
    templateId,
    sectionId,
    title,
    description,
    finalDeadline,
    studentIds,
    mode = 'individual',
    status = 'draft',
    overrideDueDates,
  } = args.data;
  const db = getDb();

  try {
    if (mode !== 'individual') {
      return serverError(ErrorCode.BAD_REQUEST, 'Group assignments are not supported yet');
    }

    const authorizedSection = await getAuthorizedInstructorSection(db, sectionId, session.user.id);
    if (!authorizedSection) {
      return serverError(ErrorCode.FORBIDDEN, 'Instructor is not authorized for this section');
    }

    const validStudents = await getActiveSectionStudentIds(db, sectionId, studentIds);
    if (validStudents.length !== studentIds.length) {
      const locale = (session.user.locale || 'en') as 'en' | 'id';
      return serverError(
        ErrorCode.BAD_REQUEST,
        translateKey('assignments.errors.invalidStudentIds', locale),
      );
    }
    const result = await db.transaction(async (tx) => {
      const [insertedAssignment] = await tx
        .insert(assignments)
        .values({
          templateId,
          sectionId,
          title,
          description,
          finalDeadline,
          instructorId: session.user.id,
          mode,
          status,
        })
        .returning({ id: assignments.id });

      const assignmentId = insertedAssignment.id;

      const studentRows = studentIds.map((studentId) => ({
        assignmentId,
        studentId,
      }));
      await tx.insert(assignmentStudents).values(studentRows);

      const tCheckpoints = await tx
        .select({
          name: templateCheckpoints.name,
          order: templateCheckpoints.order,
          minConsultations: templateCheckpoints.minConsultations,
          estimatedDuration: templateCheckpoints.estimatedDuration,
        })
        .from(templateCheckpoints)
        .where(eq(templateCheckpoints.templateId, templateId))
        .orderBy(templateCheckpoints.order);

      const [assignmentRow] = await tx
        .select({ createdAt: assignments.createdAt })
        .from(assignments)
        .where(eq(assignments.id, assignmentId))
        .limit(1);

      const baseDate = assignmentRow?.createdAt ?? new Date();

      const checkpointDueDates = calculateDueDates(tCheckpoints, baseDate);

      if (overrideDueDates) {
        for (const override of overrideDueDates) {
          checkpointDueDates.set(override.checkpointOrder, override.dueDate);
        }
      }

      // Validate sequential ordering, past dates, and finalDeadline cap
      const validation = validateDueDates(checkpointDueDates, finalDeadline);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      if (tCheckpoints.length > 0) {
        const checkpointRows: {
          assignmentId: number;
          studentId: string;
          name: string;
          order: number;
          minConsultations: number;
          dueDate: Date;
          state: 'unlocked' | 'locked';
        }[] = [];
        for (const studentId of studentIds) {
          tCheckpoints.forEach((tcp) => {
            checkpointRows.push({
              assignmentId,
              studentId,
              name: tcp.name,
              order: tcp.order,
              minConsultations: tcp.minConsultations ?? 0,
              dueDate: checkpointDueDates.get(tcp.order) ?? new Date(),
              state: tcp.order === 1 ? ('unlocked' as const) : ('locked' as const),
            });
          });
        }
        await tx.insert(checkpoints).values(checkpointRows);
      }
      await createDefaultGradeConfig(tx, assignmentId);
      return { success: true, assignmentId };
    });

    const assignmentId = result.assignmentId;
    await logAuditEvent({
      actorId: session.user.id,
      action: 'assignment.created',
      entityType: 'assignment',
      entityId: String(assignmentId),
      details: {
        templateId,
        sectionId,
        mode,
        status,
        studentCount: studentIds.length,
        deadline: finalDeadline,
      },
    });

    return result;
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Checkpoint')) {
      return serverError(ErrorCode.BAD_REQUEST, err.message);
    }
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'createAssignmentHandler',
    });
  }
}

export { unlockCheckpointHandler, extendDeadlineHandler } from './assignments-extras.server';

export {
  listStudentAssignmentsHandler,
  getStudentAssignmentDetailHandler,
} from './assignments-student.server';

export {
  listInstructorAssignmentsHandler,
  getAssignmentDetailHandler,
} from './assignments-context-handlers.server';

export { transitionAssignmentStatusHandler } from './assignments-lifecycle.server';

export { reassignAssignmentHandler } from './assignments-admin.server';
