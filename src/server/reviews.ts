// Client-safe server function wrappers (Zod schemas + createServerFn stubs)
// Handler implementations are in reviews.server.ts (not bundled for client)
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

export const ListPendingReviewsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  assignmentId: z.coerce.number().int().positive().optional(),
});

export const GetReviewDetailSchema = z.object({
  submissionId: z.coerce.number().int().positive('Submission ID must be a positive integer'),
});

export const OpenForReviewSchema = z.object({
  submissionId: z.coerce.number().int().positive('Submission ID must be a positive integer'),
});

export const SubmitReviewSchema = z.object({
  submissionId: z.coerce.number().int().positive('Submission ID must be a positive integer'),
  decision: z.enum(['pass', 'revise'], { message: 'Decision must be pass or revise' }),
  comment: z.string().optional().default(''),
  feedbackFileKey: z.string().optional(),
  revisionDeadline: z.string().optional(),
});

export const GetLatestReviewSchema = z.object({
  checkpointId: z.coerce.number().int().positive('Checkpoint ID must be a positive integer'),
});

export const listPendingReviews = createServerFn({ method: 'GET' }).handler(
  async (args: { data: unknown }) => {
    const { listPendingReviewsHandler } = await import('./reviews.server');
    const data = ListPendingReviewsSchema.parse(args.data);
    return listPendingReviewsHandler({ data });
  },
);

export const getReviewDetail = createServerFn({ method: 'GET' }).handler(
  async (args: { data: unknown }) => {
    const { getReviewDetailHandler } = await import('./reviews.server');
    const data = GetReviewDetailSchema.parse(args.data);
    return getReviewDetailHandler({ data });
  },
);

export const openForReview = createServerFn({ method: 'POST' }).handler(
  async (args: { data: unknown }) => {
    const { openForReviewHandler } = await import('./reviews.server');
    const data = OpenForReviewSchema.parse(args.data);
    return openForReviewHandler({ data });
  },
);

export const submitReview = createServerFn({ method: 'POST' }).handler(
  async (args: { data: unknown }) => {
    const { submitReviewHandler } = await import('./reviews.server');
    const data = SubmitReviewSchema.parse(args.data);
    return submitReviewHandler({ data });
  },
);

export const getLatestReview = createServerFn({ method: 'GET' }).handler(
  async (args: { data: unknown }) => {
    const { getLatestReviewHandler } = await import('./reviews.server');
    const data = GetLatestReviewSchema.parse(args.data);
    return getLatestReviewHandler({ data });
  },
);
