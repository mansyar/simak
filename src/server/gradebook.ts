// Gradebook server function stubs — Zod schemas + typedServerFn definitions.
// Handler implementations live in gradebook.server.ts (server-only, never client-bundled).
import { RATE_LIMITS } from '@/lib/rate-limiter';
import { typedServerFn } from '@/lib/server-fn';
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

// ---- Server Function Stubs ----

export const getStudentFinalGrade = typedServerFn({
  method: 'GET',
  rateLimit: RATE_LIMITS.standardRead,
})
  .inputValidator(GetStudentFinalGradeSchema)
  .handler(async ({ data }) => {
    const { getStudentFinalGradeHandler } = await import('./gradebook.server');
    return getStudentFinalGradeHandler({ data });
  });

export const getAssignmentGradebook = typedServerFn({
  method: 'GET',
  rateLimit: RATE_LIMITS.standardRead,
})
  .inputValidator(GetAssignmentGradebookSchema)
  .handler(async ({ data }) => {
    const { getAssignmentGradebookHandler } = await import('./gradebook.server');
    return getAssignmentGradebookHandler({ data });
  });

export const saveGradeConfig = typedServerFn({ method: 'POST', rateLimit: RATE_LIMITS.destructive })
  .inputValidator(SaveGradeConfigSchema)
  .handler(async ({ data }) => {
    const { saveGradeConfigHandler } = await import('./gradebook.server');
    return saveGradeConfigHandler({ data });
  });

export const recomputeAllGrades = typedServerFn({
  method: 'POST',
  rateLimit: RATE_LIMITS.destructive,
})
  .inputValidator(RecomputeAllGradesSchema)
  .handler(async ({ data }) => {
    const { recomputeAllGradesHandler } = await import('./gradebook.server');
    return recomputeAllGradesHandler({ data });
  });
