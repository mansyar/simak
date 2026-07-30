// Client-safe server function wrappers (Zod schemas + typedServerFn stubs)
// Handler implementations are in submissions.server.ts (not bundled for client)
import { RATE_LIMITS } from '@/lib/rate-limiter';
import { serverFnMiddlewares, typedServerFn } from '@/lib/server-fn';
import { z } from 'zod';
import {
  getSubmissionDetailHandler,
  listSubmissionsHandler,
  submitCheckpointHandler,
} from './submissions.server';

export const SubmitCheckpointSchema = z.object({
  checkpointId: z.coerce.number().int().positive('Checkpoint ID must be a positive integer'),
  fileKey: z.string().min(1, 'File key is required'),
  fileName: z.string().min(1, 'File name is required'),
  fileSize: z.coerce.number().int().nonnegative('File size must be non-negative'),
});

export const ListSubmissionsSchema = z.object({
  checkpointId: z.coerce.number().int().positive('Checkpoint ID must be a positive integer'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const GetSubmissionDetailSchema = z.object({
  submissionId: z.coerce.number().int().positive('Submission ID must be a positive integer'),
});

export const submitCheckpoint = typedServerFn({
  method: 'POST',
})
  .middleware(serverFnMiddlewares(RATE_LIMITS.heavyMutation))
  .handler(async (args: { data: unknown }) => {
    const data = SubmitCheckpointSchema.parse(args.data);
    return submitCheckpointHandler({ data });
  });

export const listSubmissions = typedServerFn({
  method: 'GET',
})
  .middleware(serverFnMiddlewares(RATE_LIMITS.standardRead))
  .handler(async (args: { data: unknown }) => {
    const data = ListSubmissionsSchema.parse(args.data);
    return listSubmissionsHandler({ data });
  });

export const getSubmissionDetail = typedServerFn({
  method: 'GET',
})
  .middleware(serverFnMiddlewares(RATE_LIMITS.standardRead))
  .handler(async (args: { data: unknown }) => {
    const data = GetSubmissionDetailSchema.parse(args.data);
    return getSubmissionDetailHandler({ data });
  });
