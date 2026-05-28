// Server-only handlers for file operations
import { eq, and } from 'drizzle-orm';
import { getDb } from '../db/index';
import { checkpoints, assignmentStudents } from '../db/schema/assignments';
import { submissions } from '../db/schema/submissions';
import { getSessionFromHeaders } from './auth';
import {
  generateFileKey,
  generatePresignedUploadUrl,
  generatePresignedDownloadUrl,
} from '../lib/storage';
import type { NonNullableSession } from '../lib/types';
import type { z } from 'zod';
import type {
  GetPresignedUploadUrlSchema,
  GetPresignedDownloadUrlSchema,
  GetPresignedReviewFeedbackUploadUrlSchema,
} from './files';

type GetPresignedUploadUrlInput = z.infer<typeof GetPresignedUploadUrlSchema>;
type GetPresignedDownloadUrlInput = z.infer<typeof GetPresignedDownloadUrlSchema>;
type GetPresignedReviewFeedbackUploadUrlInput = z.infer<
  typeof GetPresignedReviewFeedbackUploadUrlSchema
>;

function isStudent(session: NonNullableSession | null): session is NonNullableSession {
  return !!session && session.user.role === 'student';
}

const SUBMITTABLE_STATES = ['unlocked', 'revise'] as const;

export async function getPresignedUploadUrlHandler(args: { data: GetPresignedUploadUrlInput }) {
  const session = await getSessionFromHeaders();
  if (!isStudent(session)) {
    return { error: 'Unauthorized' };
  }

  const { checkpointId, contentType, extension } = args.data;
  const db = getDb();

  // 1. Verify the checkpoint exists and belongs to the student
  const [checkpoint] = await db
    .select({
      id: checkpoints.id,
      state: checkpoints.state,
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

  if (!SUBMITTABLE_STATES.includes(checkpoint.state as (typeof SUBMITTABLE_STATES)[number])) {
    return { error: 'Checkpoint is not in a submittable state' };
  }

  // 2. Generate UUID file key
  const fileKey = generateFileKey(extension);

  // 3. Generate presigned upload URL
  const uploadUrl = await generatePresignedUploadUrl({ key: fileKey, contentType });

  return { uploadUrl, fileKey };
}

export async function getPresignedDownloadUrlHandler(args: { data: GetPresignedDownloadUrlInput }) {
  const session = await getSessionFromHeaders();
  if (!isStudent(session)) {
    return { error: 'Unauthorized' };
  }

  const { submissionId } = args.data;
  const db = getDb();

  // 1. Verify the submission exists and belongs to the student
  const [submission] = await db
    .select({
      id: submissions.id,
      fileKey: submissions.fileKey,
      uploadedBy: submissions.uploadedBy,
    })
    .from(submissions)
    .where(and(eq(submissions.id, submissionId), eq(submissions.uploadedBy, session.user.id)))
    .limit(1);

  if (!submission) {
    return { error: 'Submission not found' };
  }

  // 2. Generate presigned download URL
  const downloadUrl = await generatePresignedDownloadUrl({ key: submission.fileKey });

  return { downloadUrl };
}

export async function getPresignedReviewFeedbackUploadUrlHandler(args: {
  data: GetPresignedReviewFeedbackUploadUrlInput;
}) {
  const session = await getSessionFromHeaders();
  if (!isInstructor(session)) {
    return { error: 'Unauthorized' };
  }

  const { extension, contentType } = args.data;

  // Generate UUID file key with 'feedback' prefix
  const fileKey = generateFileKey(extension, 'feedback');

  // Generate presigned upload URL
  const uploadUrl = await generatePresignedUploadUrl({ key: fileKey, contentType });

  return { uploadUrl, fileKey };
}

function isInstructor(session: NonNullableSession | null): session is NonNullableSession {
  return !!session && session.user.role === 'instructor';
}
