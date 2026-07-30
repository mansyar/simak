// Client-safe server function wrappers (Zod schemas + typedServerFn stubs)
// Handler implementations are in rubrics.server.ts (not bundled for client)
import { RATE_LIMITS } from '@/lib/rate-limiter';
import { typedServerFn } from '@/lib/server-fn';
import { z } from 'zod';
import type { ServerError } from '@/lib/errors';

// ── Shared base schemas ───────────────────────────────────────────

const CriterionInputSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  title: z.string().min(1, 'Criterion title is required'),
  description: z.string().optional(),
  weight: z.coerce.number().int().min(0).max(100),
  order: z.coerce.number().int().min(0),
});

const LevelInputSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  label: z.string().min(1, 'Level label is required'),
  description: z.string().optional(),
  score: z.coerce.number().int().min(0).max(100),
  order: z.coerce.number().int().min(0),
});

// ── Individual CRUD schemas ────────────────────────────────────────

export const CreateCriterionSchema = CriterionInputSchema.extend({
  templateCheckpointId: z.coerce.number().int().positive(),
});

export const UpdateCriterionSchema = CriterionInputSchema.extend({
  id: z.coerce.number().int().positive(),
});

export const CreateLevelSchema = LevelInputSchema.extend({
  templateCheckpointId: z.coerce.number().int().positive(),
});

export const UpdateLevelSchema = LevelInputSchema.extend({
  id: z.coerce.number().int().positive(),
});

export const SaveRubricSchema = z
  .object({
    templateCheckpointId: z.coerce.number().int().positive(),
    gradingType: z.enum(['numeric', 'qualitative']).nullable().default(null),
    criteria: z.array(CriterionInputSchema),
    levels: z.array(LevelInputSchema).default([]),
  })
  .superRefine((data, ctx) => {
    if (data.gradingType === null) {
      if (data.criteria.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Criteria are not allowed when grading type is null',
          path: ['criteria'],
        });
      }
      if (data.levels.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Levels are not allowed when grading type is null',
          path: ['levels'],
        });
      }
    } else {
      if (data.criteria.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'At least one criterion is required when grading type is set',
          path: ['criteria'],
        });
      } else {
        const weightSum = data.criteria.reduce((sum, c) => sum + c.weight, 0);
        if (weightSum !== 100) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Criteria weights must sum to 100, got ${weightSum}`,
            path: ['criteria'],
          });
        }
      }
      if (data.gradingType === 'qualitative') {
        if (data.levels.length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'At least one level is required for qualitative grading',
            path: ['levels'],
          });
        }
      } else {
        if (data.levels.length > 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Levels are only allowed when grading type is qualitative',
            path: ['levels'],
          });
        }
      }
    }
  });

export const DeleteCriterionSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const DeleteLevelSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const GetRubricSchema = z.object({
  templateCheckpointId: z.coerce.number().int().positive(),
});

export const CountPendingReviewsSchema = z.object({
  templateCheckpointId: z.coerce.number().int().positive(),
});

// ── Server function stubs ─────────────────────────────────────────

export const saveRubric = typedServerFn({ method: 'POST', rateLimit: RATE_LIMITS.destructive })
  .inputValidator(SaveRubricSchema)
  .handler(async ({ data }) => {
    const { saveRubricHandler } = await import('./rubrics.server');
    return saveRubricHandler({ data });
  });

export const getRubric = typedServerFn({ method: 'GET', rateLimit: RATE_LIMITS.standardRead })
  .inputValidator(GetRubricSchema)
  .handler(async ({ data }) => {
    const { getRubricHandler } = await import('./rubrics.server');
    return getRubricHandler({ data });
  });

export const softDeleteCriterion = typedServerFn({
  method: 'POST',
  rateLimit: RATE_LIMITS.destructive,
})
  .inputValidator(DeleteCriterionSchema)
  .handler(async ({ data }) => {
    const { softDeleteCriterionHandler } = await import('./rubrics.server');
    return softDeleteCriterionHandler({ data });
  });

export const softDeleteLevel = typedServerFn({ method: 'POST', rateLimit: RATE_LIMITS.destructive })
  .inputValidator(DeleteLevelSchema)
  .handler(async ({ data }) => {
    const { softDeleteLevelHandler } = await import('./rubrics.server');
    return softDeleteLevelHandler({ data });
  });

export const countPendingReviews = typedServerFn({
  method: 'GET',
  rateLimit: RATE_LIMITS.standardRead,
})
  .inputValidator(CountPendingReviewsSchema)
  .handler(async ({ data }) => {
    const { countPendingReviewsHandler } = await import('./rubrics.server');
    return countPendingReviewsHandler({ data });
  });

// ── Return types (for consumers that call via useServerFn) ─────────

export interface RubricCriterion {
  id: number;
  title: string;
  description: string | null;
  weight: number;
  order: number;
}

export interface RubricLevel {
  id: number;
  label: string;
  description: string | null;
  score: number;
  order: number;
}

export interface RubricData {
  gradingType: 'numeric' | 'qualitative' | null;
  criteria: RubricCriterion[];
  levels: RubricLevel[];
}

export type GetRubricResult = RubricData | ServerError;
export type SaveRubricResult = { success: true } | ServerError;
export type DeleteResult = { success: true } | ServerError;
export type CountPendingReviewsResult = { count: number } | ServerError;
