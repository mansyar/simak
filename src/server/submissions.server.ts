// Server-only handlers (not imported by client code)
import { eq, and, desc, sql } from 'drizzle-orm';
import { getDb } from '../db/index';
import { assignments, checkpoints, assignmentStudents } from '../db/schema/assignments';
import { notifications } from '../db/schema/notifications';
import { submissions } from '../db/schema/submissions';
import { consultations } from '../db/schema/consultations';
import { getSessionFromHeaders } from './auth';
import { generatePresignedDownloadUrl } from '../lib/storage';
import { validateUploadSize, validateUploadFileName } from '../lib/file-validation';
import { logAuditEvent } from '../lib/audit';
import { serverError, ErrorCode } from '../lib/errors';
import { getNotificationKeys, resolveNotificationContent } from './notifications.server';
import type { NonNullableSession } from '../lib/types';
import type { z } from 'zod';
import type {
  SubmitCheckpointSchema,
  ListSubmissionsSchema,
  GetSubmissionDetailSchema,
} from './submissions';

type SubmitCheckpointInput = z.infer<typeof SubmitCheckpointSchema>;
type ListSubmissionsInput = z.infer<typeof ListSubmissionsSchema>;
type GetSubmissionDetailInput = z.infer<typeof GetSubmissionDetailSchema>;

function isStudent(session: NonNullableSession | null): session is NonNullableSession {
  return !!session && session.user.role === 'student';
}

const SUBMITTABLE_STATES = ['unlocked', 'revise'] as const;

export async function submitCheckpointHandler(args: { data: SubmitCheckpointInput }) {
  const session = await getSessionFromHeaders();
  if (!isStudent(session)) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const { checkpointId, fileKey, fileName, fileSize } = args.data;
  const db = getDb();

  try {
    let submissionId: number | undefined;

    const result = await db.transaction(async (tx) => {
      // 1. Verify the checkpoint exists and belongs to the student via assignmentStudents
      const [checkpoint] = await tx
        .select({
          id: checkpoints.id,
          assignmentId: checkpoints.assignmentId,
          studentId: checkpoints.studentId,
          state: checkpoints.state,
          minConsultations: checkpoints.minConsultations,
        })
        .from(checkpoints)
        .innerJoin(
          assignmentStudents,
          eq(checkpoints.assignmentId, assignmentStudents.assignmentId),
        )
        .where(
          and(
            eq(checkpoints.id, checkpointId),
            eq(checkpoints.studentId, session.user.id),
            eq(assignmentStudents.studentId, session.user.id),
          ),
        )
        .limit(1);

      if (!checkpoint) {
        return serverError(ErrorCode.NOT_FOUND, 'Checkpoint not found');
      }

      if (checkpoint.state === 'locked') {
        return serverError(ErrorCode.BAD_REQUEST, 'Checkpoint is locked');
      }

      if (!SUBMITTABLE_STATES.includes(checkpoint.state as (typeof SUBMITTABLE_STATES)[number])) {
        return serverError(ErrorCode.BAD_REQUEST, 'Checkpoint is not in a submittable state');
      }

      // 1b. Validate file size and type server-side (TDD §5: 25MB max, .docx/.pdf only)
      const sizeCheck = validateUploadSize(fileSize);
      if (!sizeCheck.valid) {
        return serverError(
          ErrorCode.BAD_REQUEST,
          typeof sizeCheck.error === 'string' ? sizeCheck.error : String(sizeCheck.error),
        );
      }
      const nameCheck = validateUploadFileName(fileName);
      if (!nameCheck.valid) {
        return serverError(
          ErrorCode.BAD_REQUEST,
          typeof nameCheck.error === 'string' ? nameCheck.error : String(nameCheck.error),
        );
      }

      // 1c. Check consultation gating
      const minConsults = checkpoint.minConsultations ?? 0;
      if (minConsults > 0) {
        const [{ count }] = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(consultations)
          .where(
            and(
              eq(consultations.checkpointId, checkpointId),
              eq(consultations.studentId, session.user.id),
              eq(consultations.status, 'verified'),
            ),
          );

        if (Number(count) < minConsults) {
          return serverError(
            ErrorCode.BAD_REQUEST,
            `Checkpoint requires ${minConsults} verified consultations before submission (currently ${count})`,
          );
        }
      }

      // 2. Calculate next version number
      const [versionResult] = await tx
        .select({ maxVersion: sql<number>`COALESCE(MAX(${submissions.version}), 0)::int` })
        .from(submissions)
        .where(eq(submissions.checkpointId, checkpointId));

      const nextVersion = Number(versionResult?.maxVersion ?? 0) + 1;

      // 3. Insert submission record and capture the real id
      const [submissionRecord] = await tx
        .insert(submissions)
        .values({
          checkpointId,
          uploadedBy: session.user.id,
          fileKey,
          fileName,
          fileSize,
          version: nextVersion,
        })
        .returning({ id: submissions.id });

      submissionId = submissionRecord.id;

      // 4. Transition checkpoint state to 'submitted'
      await tx
        .update(checkpoints)
        .set({ state: 'submitted', updatedAt: new Date() })
        .where(eq(checkpoints.id, checkpointId));

      // 5. Notify the instructor (submission_received event)
      const [instructorInfo] = await tx
        .select({
          instructorId: assignments.instructorId,
          assignmentTitle: assignments.title,
        })
        .from(assignments)
        .where(eq(assignments.id, checkpoint.assignmentId))
        .limit(1);

      if (instructorInfo) {
        const receivedParams = {
          studentName: session.user.name || 'A student',
          assignmentTitle: instructorInfo.assignmentTitle,
        };
        const receivedKeys = getNotificationKeys('submission_received');
        const receivedContent = resolveNotificationContent(
          receivedKeys.titleKey,
          receivedKeys.messageKey,
          receivedParams,
          'en',
        );
        await tx.insert(notifications).values({
          userId: instructorInfo.instructorId,
          type: 'submission_received',
          title: receivedContent.title,
          message: receivedContent.message,
          titleKey: receivedKeys.titleKey,
          messageKey: receivedKeys.messageKey,
          params: receivedParams,
          channel: 'in_app',
          metadata: {
            checkpointId,
            assignmentId: checkpoint.assignmentId,
            submissionId: submissionRecord.id,
          },
        });
      }

      return { success: true };
    });

    // Post-commit advisory work: audit log of the successful submission.
    // Wrapped in try/catch so a failure here never surfaces an error for a committed transaction.
    try {
      if (submissionId) {
        await logAuditEvent({
          actorId: session.user.id,
          action: 'submission.created',
          entityType: 'submission',
          entityId: String(submissionId),
          details: { checkpointId, fileName },
        });
      }
    } catch (err) {
      console.error('Failed to log submission.created audit event:', err);
    }

    return result;
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'submitCheckpointHandler',
    });
  }
}

export async function listSubmissionsHandler(args: { data: ListSubmissionsInput }) {
  const session = await getSessionFromHeaders();
  if (!isStudent(session)) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const { checkpointId } = args.data;
  const db = getDb();

  try {
    // 1. Verify ownership via assignment_students join
    const [checkpoint] = await db
      .select({ id: checkpoints.id, studentId: checkpoints.studentId })
      .from(checkpoints)
      .innerJoin(assignmentStudents, eq(checkpoints.assignmentId, assignmentStudents.assignmentId))
      .where(
        and(
          eq(checkpoints.id, checkpointId),
          eq(checkpoints.studentId, session.user.id),
          eq(assignmentStudents.studentId, session.user.id),
        ),
      )
      .limit(1);

    if (!checkpoint) {
      return serverError(ErrorCode.NOT_FOUND, 'Checkpoint not found');
    }

    // 2. Fetch all submissions for this checkpoint, newest first
    const submissionList = await db
      .select({
        id: submissions.id,
        version: submissions.version,
        fileName: submissions.fileName,
        fileSize: submissions.fileSize,
        uploadedAt: submissions.uploadedAt,
      })
      .from(submissions)
      .where(eq(submissions.checkpointId, checkpointId))
      .orderBy(desc(submissions.version));

    return { submissions: submissionList };
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'listSubmissionsHandler',
    });
  }
}

export async function getSubmissionDetailHandler(args: { data: GetSubmissionDetailInput }) {
  const session = await getSessionFromHeaders();
  if (!isStudent(session)) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const { submissionId } = args.data;
  const db = getDb();

  try {
    // 1. Fetch submission with ownership check
    const [submission] = await db
      .select({
        id: submissions.id,
        checkpointId: submissions.checkpointId,
        uploadedBy: submissions.uploadedBy,
        fileKey: submissions.fileKey,
        fileName: submissions.fileName,
        fileSize: submissions.fileSize,
        version: submissions.version,
        uploadedAt: submissions.uploadedAt,
      })
      .from(submissions)
      .where(and(eq(submissions.id, submissionId), eq(submissions.uploadedBy, session.user.id)))
      .limit(1);

    if (!submission) {
      return serverError(ErrorCode.NOT_FOUND, 'Submission not found');
    }

    // 2. Generate download URL
    const downloadUrl = await generatePresignedDownloadUrl({ key: submission.fileKey });

    return {
      submission: {
        ...submission,
        downloadUrl,
      },
    };
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'getSubmissionDetailHandler',
    });
  }
}
