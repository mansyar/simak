// Gradebook server function stubs — Zod schemas + typedServerFn definitions.
// Handler implementations live in gradebook.server.ts (server-only, never client-bundled).
import { RATE_LIMITS } from '@/lib/rate-limiter';
import { serverFnMiddlewares, typedServerFn } from '@/lib/server-fn';
import { z } from 'zod';

// ---- Schemas ----

export const GetStudentFinalGradeSchema = z.object({
  assignmentId: z.number().int().positive(),
});

export const GetAssignmentGradebookSchema = z.object({
  assignmentId: z.number().int().positive(),
});

export const SaveGradeConfigSchema = z
  .object({
    assignmentId: z.number().int().positive(),
    gradingScheme: z.enum(['equal_weight', 'custom_weight']),
    customWeights: z.record(z.string(), z.number()).nullable(),
    letterGradeBounds: z.object({
      A: z.number(),
      B: z.number(),
      C: z.number(),
      D: z.number(),
    }),
  })
  .superRefine((data, ctx) => {
    if (data.gradingScheme === 'custom_weight') {
      if (!data.customWeights) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Custom weights are required when grading scheme is custom_weight',
          path: ['customWeights'],
        });
        return;
      }
      const sum = Object.values(data.customWeights).reduce((a, b) => a + b, 0);
      if (sum !== 100) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Custom weights must sum to 100',
          path: ['customWeights'],
        });
      }
    }
  });

export const RecomputeAllGradesSchema = z.object({
  assignmentId: z.number().int().positive(),
});

export const PreflightGradeReleaseSchema = z.object({
  assignmentId: z.number().int().positive(),
});

export const PublishGradeReleaseSchema = z.object({
  assignmentId: z.number().int().positive(),
  confirmed: z.literal(true),
  incompleteOutcomes: z
    .array(
      z.object({
        studentId: z.string().trim().min(1),
        reason: z.string().trim().min(1).max(1000),
      }),
    )
    .max(500)
    .default([])
    .refine(
      (outcomes) => new Set(outcomes.map((outcome) => outcome.studentId)).size === outcomes.length,
      'Incomplete outcomes must identify unique students',
    ),
});

export const WithdrawGradeReleaseSchema = z.object({
  assignmentId: z.number().int().positive(),
  reason: z.string().trim().min(1).max(1000),
});

// ---- Server Function Stubs ----

export const getStudentFinalGrade = typedServerFn({
  method: 'GET',
})
  .middleware(serverFnMiddlewares(RATE_LIMITS.standardRead))
  .inputValidator(GetStudentFinalGradeSchema)
  .handler(async ({ data }) => {
    const { getStudentFinalGradeHandler } = await import('./gradebook.server');
    return getStudentFinalGradeHandler({ data });
  });

export const getAssignmentGradebook = typedServerFn({
  method: 'GET',
})
  .middleware(serverFnMiddlewares(RATE_LIMITS.standardRead))
  .inputValidator(GetAssignmentGradebookSchema)
  .handler(async ({ data }) => {
    const { getAssignmentGradebookHandler } = await import('./gradebook.server');
    return getAssignmentGradebookHandler({ data });
  });

export const saveGradeConfig = typedServerFn({ method: 'POST' })
  .middleware(serverFnMiddlewares(RATE_LIMITS.destructive))
  .inputValidator(SaveGradeConfigSchema)
  .handler(async ({ data }) => {
    const { saveGradeConfigHandler } = await import('./gradebook.server');
    return saveGradeConfigHandler({ data });
  });

export const recomputeAllGrades = typedServerFn({
  method: 'POST',
})
  .middleware(serverFnMiddlewares(RATE_LIMITS.destructive))
  .inputValidator(RecomputeAllGradesSchema)
  .handler(async ({ data }) => {
    const { recomputeAllGradesHandler } = await import('./gradebook.server');
    return recomputeAllGradesHandler({ data });
  });

export const getGradeReleasePreflight = typedServerFn({
  method: 'GET',
})
  .middleware(serverFnMiddlewares(RATE_LIMITS.standardRead))
  .inputValidator(PreflightGradeReleaseSchema)
  .handler(async ({ data }) => {
    const { getGradeReleasePreflightHandler } = await import('./gradebook-extras.server');
    return getGradeReleasePreflightHandler({ data });
  });

export const publishGradeRelease = typedServerFn({ method: 'POST' })
  .middleware(serverFnMiddlewares(RATE_LIMITS.destructive))
  .inputValidator(PublishGradeReleaseSchema)
  .handler(async ({ data }) => {
    const { publishGradeReleaseHandler } = await import('./gradebook-extras.server');
    return publishGradeReleaseHandler({ data });
  });

export const withdrawGradeRelease = typedServerFn({ method: 'POST' })
  .middleware(serverFnMiddlewares(RATE_LIMITS.destructive))
  .inputValidator(WithdrawGradeReleaseSchema)
  .handler(async ({ data }) => {
    const { withdrawGradeReleaseHandler } = await import('./gradebook-extras.server');
    return withdrawGradeReleaseHandler({ data });
  });
