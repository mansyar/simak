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
import { validateUploadType } from '../lib/file-validation';
function isStudent(session) {
  return !!session && session.user.role === 'student';
}
const SUBMITTABLE_STATES = ['unlocked', 'revise'];
export async function getPresignedUploadUrlHandler(args) {
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
  if (!SUBMITTABLE_STATES.includes(checkpoint.state)) {
    return { error: 'Checkpoint is not in a submittable state' };
  }
  // 2. Validate file type server-side (TDD §5: .docx/.pdf only, server-side MIME check)
  const typeCheck = validateUploadType(extension, contentType);
  if (!typeCheck.valid) {
    return { error: typeCheck.error };
  }
  // 3. Generate UUID file key
  const fileKey = generateFileKey(extension);
  // 4. Generate presigned upload URL
  const uploadUrl = await generatePresignedUploadUrl({ key: fileKey, contentType });
  return { uploadUrl, fileKey };
}
export async function getPresignedDownloadUrlHandler(args) {
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
export async function getPresignedReviewFeedbackUploadUrlHandler(args) {
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
function isInstructor(session) {
  return !!session && session.user.role === 'instructor';
}
