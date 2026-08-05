// Client-safe server function wrappers (Zod schemas + typedServerFn stubs)
// Handler implementations are in feedback-snippets.server.ts (not bundled for client)
import { RATE_LIMITS } from '@/lib/rate-limiter';
import { serverFnMiddlewares, typedServerFn } from '@/lib/server-fn';
import type { ServerError } from '@/lib/errors';
import { z } from 'zod';

const MAX_TITLE_LENGTH = 100;
const MAX_CATEGORY_LENGTH = 50;
const MAX_BODY_LENGTH = 2000;
const DISALLOWED_PLAIN_TEXT_PATTERN = /<\/?[a-z][^>]*>|\{\{[\s\S]*?\}\}|\$\{[\s\S]*?\}/i;

function isPlainText(value: string): boolean {
  return !DISALLOWED_PLAIN_TEXT_PATTERN.test(value);
}

function requiredPlainText(label: string, maxLength: number) {
  return z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(maxLength, `${label} must be ${maxLength} characters or fewer`)
    .refine(isPlainText, `${label} must be plain text without markup or placeholders`);
}

const optionalCategory = z.preprocess(
  (value) => (typeof value === 'string' ? value.trim() || null : value),
  z
    .string()
    .max(MAX_CATEGORY_LENGTH, `Category must be ${MAX_CATEGORY_LENGTH} characters or fewer`)
    .refine(isPlainText, 'Category must be plain text without markup or placeholders')
    .nullable()
    .optional(),
);

export const ListFeedbackSnippetsSchema = z.object({
  archived: z.boolean().default(false),
  search: z.string().trim().max(100).default(''),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const CreateFeedbackSnippetSchema = z.object({
  title: requiredPlainText('Title', MAX_TITLE_LENGTH),
  category: optionalCategory,
  body: requiredPlainText('Body', MAX_BODY_LENGTH),
});

export const UpdateFeedbackSnippetSchema = CreateFeedbackSnippetSchema.extend({
  id: z.string().uuid('Feedback snippet ID must be a valid UUID'),
});

export const FeedbackSnippetIdSchema = z.object({
  id: z.string().uuid('Feedback snippet ID must be a valid UUID'),
});

export const ArchiveFeedbackSnippetSchema = FeedbackSnippetIdSchema;
export const RestoreFeedbackSnippetSchema = FeedbackSnippetIdSchema;

export const listFeedbackSnippets = typedServerFn({ method: 'GET' })
  .middleware(serverFnMiddlewares(RATE_LIMITS.standardRead))
  .inputValidator(ListFeedbackSnippetsSchema)
  .handler(async ({ data }) => {
    const { listFeedbackSnippetsHandler } = await import('./feedback-snippets.server');
    return listFeedbackSnippetsHandler({ data });
  });

export const createFeedbackSnippet = typedServerFn({ method: 'POST' })
  .middleware(serverFnMiddlewares(RATE_LIMITS.destructive))
  .inputValidator(CreateFeedbackSnippetSchema)
  .handler(async ({ data }) => {
    const { createFeedbackSnippetHandler } = await import('./feedback-snippets.server');
    return createFeedbackSnippetHandler({ data });
  });

export const updateFeedbackSnippet = typedServerFn({ method: 'POST' })
  .middleware(serverFnMiddlewares(RATE_LIMITS.destructive))
  .inputValidator(UpdateFeedbackSnippetSchema)
  .handler(async ({ data }) => {
    const { updateFeedbackSnippetHandler } = await import('./feedback-snippets.server');
    return updateFeedbackSnippetHandler({ data });
  });

export const archiveFeedbackSnippet = typedServerFn({ method: 'POST' })
  .middleware(serverFnMiddlewares(RATE_LIMITS.destructive))
  .inputValidator(ArchiveFeedbackSnippetSchema)
  .handler(async ({ data }) => {
    const { archiveFeedbackSnippetHandler } = await import('./feedback-snippets.server');
    return archiveFeedbackSnippetHandler({ data });
  });

export const restoreFeedbackSnippet = typedServerFn({ method: 'POST' })
  .middleware(serverFnMiddlewares(RATE_LIMITS.destructive))
  .inputValidator(RestoreFeedbackSnippetSchema)
  .handler(async ({ data }) => {
    const { restoreFeedbackSnippetHandler } = await import('./feedback-snippets.server');
    return restoreFeedbackSnippetHandler({ data });
  });

export interface FeedbackSnippet {
  id: string;
  title: string;
  category: string | null;
  body: string;
  archivedAt: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface FeedbackSnippetListItem {
  id: string;
  title: string;
  category: string | null;
  body: string;
  archivedAt: Date | null;
}

export type ListFeedbackSnippetsResult =
  | { snippets: FeedbackSnippetListItem[]; total: number; page: number; limit: number }
  | ServerError;
export type FeedbackSnippetMutationResult = { snippet: FeedbackSnippet } | ServerError;
