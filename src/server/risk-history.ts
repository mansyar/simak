// Client-safe risk-history server-function wrappers.
// Handler implementations are in risk-history.server.ts (not client-bundled).
import { RATE_LIMITS } from '@/lib/rate-limiter';
import { serverFnMiddlewares, typedServerFn } from '@/lib/server-fn';
import { z } from 'zod';

const PositiveIdSchema = z.coerce.number().int().positive();
const StudentIdSchema = z.string().trim().min(1).max(255);
const DateRangeSchema = z
  .object({
    from: z.coerce.date().nullish(),
    to: z.coerce.date().nullish(),
  })
  .transform((range) => ({ from: range.from ?? null, to: range.to ?? null }));

export const RiskObservationSourceSchema = z.enum(['lifecycle_event', 'daily_snapshot']);
export const RiskLifecycleEventTypeSchema = z.enum([
  'checkpoint_updated',
  'submission_recorded',
  'review_recorded',
  'consultation_verified',
  'intervention_updated',
]);

const RiskFactorSnapshotSchema = z
  .object({
    code: z.string().trim().min(1).max(100),
    category: z.string().trim().min(1).max(100),
    severity: z.enum(['low', 'medium', 'high']),
  })
  .strict();

export const RiskObservationSnapshotSchema = z
  .object({
    source: RiskObservationSourceSchema,
    eventType: RiskLifecycleEventTypeSchema.nullish(),
    sourceEventId: z.string().trim().min(1).max(255).nullish(),
    idempotencyKey: z.string().trim().min(1).max(255),
    assignmentId: PositiveIdSchema,
    studentId: StudentIdSchema,
    checkpointId: PositiveIdSchema.nullish(),
    interventionId: PositiveIdSchema.nullish(),
    observedAt: z.coerce.date(),
    algorithmVersion: z.string().trim().min(1).max(100),
    riskLevel: z.enum(['low', 'medium', 'high']),
    factors: z.array(RiskFactorSnapshotSchema),
    explanationSnapshot: z.record(z.string(), z.unknown()),
  })
  .strict()
  .superRefine((snapshot, context) => {
    if (
      snapshot.source === 'lifecycle_event' &&
      (snapshot.eventType == null || snapshot.sourceEventId == null)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Lifecycle observations require an event type and source event identity',
      });
    }

    if (
      snapshot.source === 'daily_snapshot' &&
      (snapshot.eventType != null || snapshot.sourceEventId != null)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Daily snapshots cannot include lifecycle event identity',
      });
    }
  });

export const ListInstructorRiskHistorySchema = z
  .object({
    assignmentId: PositiveIdSchema,
    studentId: StudentIdSchema,
    from: z.coerce.date().nullish(),
    to: z.coerce.date().nullish(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .transform((input) => ({
    ...input,
    from: input.from ?? null,
    to: input.to ?? null,
  }));

export const GetAdminRiskTrendsSchema = z
  .object({
    termId: PositiveIdSchema.nullish(),
    courseId: PositiveIdSchema.nullish(),
    sectionId: PositiveIdSchema.nullish(),
  })
  .and(DateRangeSchema)
  .transform((input) => ({
    termId: input.termId ?? null,
    courseId: input.courseId ?? null,
    sectionId: input.sectionId ?? null,
    from: input.from,
    to: input.to,
  }))
  .refine((input) => input.termId !== null || input.courseId !== null || input.sectionId !== null, {
    message: 'At least one academic context filter is required',
  });

export const GetStudentSupportStatusSchema = z.object({ assignmentId: PositiveIdSchema });

export const StudentSupportStatusSchema = z
  .object({
    status: z.enum(['on_track', 'support_available']),
    nextSteps: z.array(z.string().trim().min(1).max(500)).max(5),
  })
  .strict();

export const listInstructorRiskHistory = typedServerFn({ method: 'GET' })
  .middleware(serverFnMiddlewares(RATE_LIMITS.standardRead))
  .inputValidator(ListInstructorRiskHistorySchema)
  .handler(async ({ data }) => {
    const { listInstructorRiskHistoryHandler } = await import('./risk-history.server');
    return listInstructorRiskHistoryHandler({ data });
  });

export const getAdminRiskTrends = typedServerFn({ method: 'GET' })
  .middleware(serverFnMiddlewares(RATE_LIMITS.standardRead))
  .inputValidator(GetAdminRiskTrendsSchema)
  .handler(async ({ data }) => {
    const { getAdminRiskTrendsHandler } = await import('./risk-history.server');
    return getAdminRiskTrendsHandler({ data });
  });

export const getStudentSupportStatus = typedServerFn({ method: 'GET' })
  .middleware(serverFnMiddlewares(RATE_LIMITS.standardRead))
  .inputValidator(GetStudentSupportStatusSchema)
  .handler(async ({ data }) => {
    const { getStudentSupportStatusHandler } = await import('./risk-history.server');
    return getStudentSupportStatusHandler({ data });
  });
