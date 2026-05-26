// Server-only handlers (not imported by client code)
import { eq, and, desc, sql } from 'drizzle-orm';
import { getDb } from '../db/index';
import { assignments, checkpoints, assignmentStudents } from '../db/schema/assignments';
import { notifications } from '../db/schema/notifications';
import { submissions } from '../db/schema/submissions';
import { consultations } from '../db/schema/consultations';
import { getSessionFromHeaders } from './auth';
import { generatePresignedDownloadUrl } from '../lib/storage';
import type { z } from 'zod';
import type {
  SubmitCheckpointSchema,
  ListSubmissionsSchema,
  GetSubmissionDetailSchema,
} from './submissions';

type SubmitCheckpointInput = z.infer<typeof SubmitCheckpointSchema>;
type ListSubmissionsInput = z.infer<typeof ListSubmissionsSchema>;
type GetSubmissionDetailInput = z.infer<typeof GetSubmissionDetailSchema>;

function isStudent(session: any): session is { user: { id: string; role: string }; session: any } {
  return !!session && session.user.role === 'student';
}

const SUBMITTABLE_STATES = ['unlocked', 'revise'] as const;

export async function submitCheckpointHandler(args: { data: SubmitCheckpointInput }) {
  const session = await getSessionFromHeaders();
  if (!isStudent(session)) {
    return { error: 'Unauthorized' };
  }

  const { checkpointId, fileKey, fileName, fileSize } = args.data;
  const db = getDb();

  // 1. Verify the checkpoint exists and belongs to the student via assignmentStudents
  const [checkpoint] = await db
    .select({
      id: checkpoints.id,
      assignmentId: checkpoints.assignmentId,
      studentId: checkpoints.studentId,
      state: checkpoints.state,
      minConsultations: checkpoints.minConsultations,
    })
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
    return { error: 'Checkpoint not found' };
  }

  if (checkpoint.state === 'locked') {
    return { error: 'Checkpoint is locked' };
  }

  if (!SUBMITTABLE_STATES.includes(checkpoint.state as (typeof SUBMITTABLE_STATES)[number])) {
    return { error: 'Checkpoint is not in a submittable state' };
  }

  // 1b. Check consultation gating
  const minConsults = checkpoint.minConsultations ?? 0;
  if (minConsults > 0) {
    const [{ count }] = await db
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
      return {
        error: `Checkpoint requires ${minConsults} verified consultations before submission (currently ${count})`,
      };
    }
  }

  // 2. Calculate next version number
  const [versionResult] = await db
    .select({ maxVersion: sql<number>`COALESCE(MAX(${submissions.version}), 0)::int` })
    .from(submissions)
    .where(eq(submissions.checkpointId, checkpointId));

  const nextVersion = Number(versionResult?.maxVersion ?? 0) + 1;

  // 3. Insert submission record
  await db.insert(submissions).values({
    checkpointId,
    uploadedBy: session.user.id,
    fileKey,
    fileName,
    fileSize,
    version: nextVersion,
  });

  // 4. Transition checkpoint state to 'submitted'
  await db
    .update(checkpoints)
    .set({ state: 'submitted', updatedAt: new Date() })
    .where(eq(checkpoints.id, checkpointId));

  // 5. Notify the instructor (submission_received event)
  try {
    const [instructorInfo] = await db
      .select({
        instructorId: assignments.instructorId,
        assignmentTitle: assignments.title,
      })
      .from(assignments)
      .where(eq(assignments.id, checkpoint.assignmentId))
      .limit(1);

    if (instructorInfo) {
      await db.insert(notifications).values({
        userId: instructorInfo.instructorId,
        type: 'submission_received',
        title: 'New Submission Received',
        message: `${session.user.name || 'A student'} has submitted a checkpoint for ${instructorInfo.assignmentTitle}.`,
        channel: 'in_app',
        metadata: {
          checkpointId,
          assignmentId: checkpoint.assignmentId,
          submissionId: nextVersion,
        },
      });
    }
  } catch (err) {
    // Non-blocking error logging for notification dispatch
    console.error('Failed to create submission_received notification:', err);
  }

  return { success: true };
}

export async function listSubmissionsHandler(args: { data: ListSubmissionsInput }) {
  const session = await getSessionFromHeaders();
  if (!isStudent(session)) {
    return { error: 'Unauthorized' };
  }

  const { checkpointId } = args.data;
  const db = getDb();

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
    return { error: 'Checkpoint not found' };
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
}

export async function getSubmissionDetailHandler(args: { data: GetSubmissionDetailInput }) {
  const session = await getSessionFromHeaders();
  if (!isStudent(session)) {
    return { error: 'Unauthorized' };
  }

  const { submissionId } = args.data;
  const db = getDb();

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
    return { error: 'Submission not found' };
  }

  // 2. Generate download URL
  const downloadUrl = await generatePresignedDownloadUrl({ key: submission.fileKey });

  return {
    submission: {
      ...submission,
      downloadUrl,
    },
  };
}
