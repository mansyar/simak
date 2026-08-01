// Client-safe server function wrappers (Zod schemas + typedServerFn stubs)
// Handler implementations are in interventions.server.ts (not bundled for client)
import { RATE_LIMITS } from '@/lib/rate-limiter';
import { serverFnMiddlewares, typedServerFn } from '@/lib/server-fn';
import { z } from 'zod';

const PositiveIdSchema = z.coerce.number().int().positive();
const StudentIdSchema = z.string().trim().min(1);

export const InterventionActionTypeSchema = z.enum([
  'consultation',
  'extension',
  'discussion',
  'other',
]);

export const InterventionStatusSchema = z.enum(['open', 'monitoring', 'resolved', 'dismissed']);

const ResolutionReasonSchema = z.string().trim().min(1).max(5000);

export const CreateInterventionSchema = z.object({
  assignmentId: PositiveIdSchema,
  studentId: StudentIdSchema,
  actionType: InterventionActionTypeSchema,
  privateNote: z.string().trim().max(5000).optional(),
  followUpDate: z.coerce.date().optional(),
});

export const ListInterventionsSchema = z.object({
  assignmentId: PositiveIdSchema.optional(),
  studentId: StudentIdSchema.optional(),
  status: InterventionStatusSchema.optional(),
  overdue: z.boolean().default(false),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const GetInterventionContextSchema = z.object({
  assignmentId: PositiveIdSchema,
  studentId: StudentIdSchema,
});

export const UpdateInterventionSchema = z
  .object({
    interventionId: PositiveIdSchema,
    actionType: InterventionActionTypeSchema.optional(),
    privateNote: z.string().trim().max(5000).nullable().optional(),
    followUpDate: z.coerce.date().nullable().optional(),
    status: InterventionStatusSchema.optional(),
    resolutionReason: ResolutionReasonSchema.nullable().optional(),
  })
  .superRefine((data, context) => {
    if ((data.status === 'resolved' || data.status === 'dismissed') && !data.resolutionReason) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['resolutionReason'],
        message: 'A reason is required when resolving or dismissing an intervention',
      });
    }

    if (
      data.actionType === undefined &&
      data.privateNote === undefined &&
      data.followUpDate === undefined &&
      data.status === undefined &&
      data.resolutionReason === undefined
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one intervention field must be updated',
      });
    }
  });

export const createIntervention = typedServerFn({ method: 'POST' })
  .middleware(serverFnMiddlewares(RATE_LIMITS.destructive))
  .inputValidator(CreateInterventionSchema)
  .handler(async ({ data }) => {
    const { createInterventionHandler } = await import('./interventions.server');
    return createInterventionHandler({ data });
  });

export const listInterventions = typedServerFn({ method: 'GET' })
  .middleware(serverFnMiddlewares(RATE_LIMITS.standardRead))
  .inputValidator(ListInterventionsSchema)
  .handler(async ({ data }) => {
    const { listInterventionsHandler } = await import('./interventions.server');
    return listInterventionsHandler({ data });
  });

export const getInterventionContext = typedServerFn({ method: 'GET' })
  .middleware(serverFnMiddlewares(RATE_LIMITS.standardRead))
  .inputValidator(GetInterventionContextSchema)
  .handler(async ({ data }) => {
    const { getInterventionContextHandler } = await import('./interventions.server');
    return getInterventionContextHandler({ data });
  });

export const updateIntervention = typedServerFn({ method: 'POST' })
  .middleware(serverFnMiddlewares(RATE_LIMITS.destructive))
  .inputValidator(UpdateInterventionSchema)
  .handler(async ({ data }) => {
    const { updateInterventionHandler } = await import('./interventions.server');
    return updateInterventionHandler({ data });
  });
