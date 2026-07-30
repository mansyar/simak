// Client-safe server function wrappers for file operations
import { RATE_LIMITS } from '@/lib/rate-limiter';
import { typedServerFn } from '@/lib/server-fn';
import { z } from 'zod';

export const GetPresignedUploadUrlSchema = z.object({
  checkpointId: z.coerce.number().int().positive('Checkpoint ID must be a positive integer'),
  contentType: z.string().min(1, 'Content type is required'),
  extension: z.string().min(1, 'File extension is required'),
});

export const GetPresignedDownloadUrlSchema = z.object({
  submissionId: z.coerce.number().int().positive('Submission ID must be a positive integer'),
});

export const getPresignedUploadUrl = typedServerFn({
  method: 'GET',
  rateLimit: RATE_LIMITS.presignedUrl,
}).handler(async (args: { data: unknown }) => {
  const { getPresignedUploadUrlHandler } = await import('./files.server');
  const data = GetPresignedUploadUrlSchema.parse(args.data);
  return getPresignedUploadUrlHandler({ data });
});

export const getPresignedDownloadUrl = typedServerFn({
  method: 'GET',
  rateLimit: RATE_LIMITS.presignedUrl,
}).handler(async (args: { data: unknown }) => {
  const { getPresignedDownloadUrlHandler } = await import('./files.server');
  const data = GetPresignedDownloadUrlSchema.parse(args.data);
  return getPresignedDownloadUrlHandler({ data });
});

export const GetPresignedReviewFeedbackUploadUrlSchema = z.object({
  extension: z.string().min(1, 'File extension is required'),
  contentType: z.string().min(1, 'Content type is required'),
});

export const getPresignedReviewFeedbackUploadUrl = typedServerFn({
  method: 'GET',
  rateLimit: RATE_LIMITS.presignedUrl,
}).handler(async (args: { data: unknown }) => {
  const { getPresignedReviewFeedbackUploadUrlHandler } = await import('./files.server');
  const data = GetPresignedReviewFeedbackUploadUrlSchema.parse(args.data);
  return getPresignedReviewFeedbackUploadUrlHandler({ data });
});
