// Client-safe server function wrappers (Zod schemas + createServerFn stubs)
// Handler implementations are in submissions.server.ts (not bundled for client)
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
export const SubmitCheckpointSchema = z.object({
  checkpointId: z.coerce.number().int().positive('Checkpoint ID must be a positive integer'),
  fileKey: z.string().min(1, 'File key is required'),
  fileName: z.string().min(1, 'File name is required'),
  fileSize: z.coerce.number().int().nonnegative('File size must be non-negative'),
});
export const ListSubmissionsSchema = z.object({
  checkpointId: z.coerce.number().int().positive('Checkpoint ID must be a positive integer'),
});
export const GetSubmissionDetailSchema = z.object({
  submissionId: z.coerce.number().int().positive('Submission ID must be a positive integer'),
});
export const submitCheckpoint = createServerFn({ method: 'POST' }).handler(async (args) => {
  const { submitCheckpointHandler } = await import('./submissions.server');
  const data = SubmitCheckpointSchema.parse(args.data);
  return submitCheckpointHandler({ data });
});
export const listSubmissions = createServerFn({ method: 'GET' }).handler(async (args) => {
  const { listSubmissionsHandler } = await import('./submissions.server');
  const data = ListSubmissionsSchema.parse(args.data);
  return listSubmissionsHandler({ data });
});
export const getSubmissionDetail = createServerFn({ method: 'GET' }).handler(async (args) => {
  const { getSubmissionDetailHandler } = await import('./submissions.server');
  const data = GetSubmissionDetailSchema.parse(args.data);
  return getSubmissionDetailHandler({ data });
});
