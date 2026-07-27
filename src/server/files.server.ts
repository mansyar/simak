// Server-only handlers for file operations
import { eq, and } from 'drizzle-orm';
import { getDb } from '../db/index';
import { checkpoints, assignmentStudents } from '../db/schema/assignments';
import { submissions, uploadIntents } from '../db/schema/submissions';
import { getSessionFromHeaders } from './auth';
import { serverError, ErrorCode } from '../lib/errors';
import {
  generateFileKey,
  generatePresignedUploadUrl,
  generatePresignedDownloadUrl,
} from '../lib/storage';
import { validateUploadType } from '../lib/file-validation';
import { isStudent, isInstructor } from '../lib/session-guards';
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

const SUBMITTABLE_STATES = ['unlocked', 'revise'] as const;

export async function getPresignedUploadUrlHandler(args: { data: GetPresignedUploadUrlInput }) {
  const session = await getSessionFromHeaders();
  if (!isStudent(session)) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const { checkpointId, contentType, extension } = args.data;
  const db = getDb();

  try {
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
      return serverError(ErrorCode.NOT_FOUND, 'Checkpoint not found');
    }

    if (!SUBMITTABLE_STATES.includes(checkpoint.state as (typeof SUBMITTABLE_STATES)[number])) {
      return serverError(ErrorCode.BAD_REQUEST, 'Checkpoint is not in a submittable state');
    }

    // 2. Validate file type server-side (TDD §5: .docx/.pdf only, server-side MIME check)
    const typeCheck = validateUploadType(extension, contentType);
    if (!typeCheck.valid) {
      const message =
        typeof typeCheck.error === 'string' ? typeCheck.error : String(typeCheck.error);
      return serverError(ErrorCode.BAD_REQUEST, message);
    }

    // 3. Generate UUID file key
    const fileKey = generateFileKey(extension);

    // 4. Generate presigned upload URL
    const uploadUrl = await generatePresignedUploadUrl({ key: fileKey, contentType });

    // 5. Record upload intent bound to the acting user and checkpoint.
    //    This is the trust token that submitCheckpointHandler will verify.
    await db.insert(uploadIntents).values({
      fileKey,
      userId: session.user.id,
      purpose: 'submission',
      checkpointId,
      fileName: null,
      fileSize: null,
      contentType,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      consumedAt: null,
    });

    return { uploadUrl, fileKey };
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'getPresignedUploadUrlHandler',
    });
  }
}

export async function getPresignedDownloadUrlHandler(args: { data: GetPresignedDownloadUrlInput }) {
  const session = await getSessionFromHeaders();
  if (!isStudent(session)) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const { submissionId } = args.data;
  const db = getDb();

  try {
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
      return serverError(ErrorCode.NOT_FOUND, 'Submission not found');
    }

    // 2. Generate presigned download URL
    const downloadUrl = await generatePresignedDownloadUrl({ key: submission.fileKey });

    return { downloadUrl };
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'getPresignedDownloadUrlHandler',
    });
  }
}

export async function getPresignedReviewFeedbackUploadUrlHandler(args: {
  data: GetPresignedReviewFeedbackUploadUrlInput;
}) {
  const session = await getSessionFromHeaders();
  if (!isInstructor(session)) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const { extension, contentType } = args.data;
  const db = getDb();

  const typeCheck = validateUploadType(extension, contentType);
  if (!typeCheck.valid) {
    return serverError(
      ErrorCode.BAD_REQUEST,
      typeof typeCheck.error === 'string' ? typeCheck.error : String(typeCheck.error),
    );
  }

  try {
    // Generate UUID file key with 'feedback' prefix
    const fileKey = generateFileKey(extension, 'feedback');

    // Generate presigned upload URL
    const uploadUrl = await generatePresignedUploadUrl({ key: fileKey, contentType });

    // Record upload intent bound to the acting instructor for review feedback.
    await db.insert(uploadIntents).values({
      fileKey,
      userId: session.user.id,
      purpose: 'review_feedback',
      checkpointId: null,
      fileName: null,
      fileSize: null,
      contentType,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      consumedAt: null,
    });

    return { uploadUrl, fileKey };
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'getPresignedReviewFeedbackUploadUrlHandler',
    });
  }
}
