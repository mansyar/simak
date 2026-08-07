// Client-safe server function wrappers (Zod schemas + typedServerFn stubs)
// Handler implementations are in assignments.server.ts (not bundled for client)
import { RATE_LIMITS } from '@/lib/rate-limiter';
import { serverFnMiddlewares, typedServerFn } from '@/lib/server-fn';
import { z } from 'zod';

export const OverrideDueDateSchema = z.object({
  checkpointOrder: z.coerce.number().int().positive('Checkpoint order must be positive'),
  dueDate: z.coerce.date(),
});

export const AssignmentModeSchema = z.enum(['individual', 'group']);

export const AssignmentStatusSchema = z.enum(['draft', 'active', 'archived']);

export const CreateAssignmentSchema = z.object({
  templateId: z.coerce.number().int().positive('Template is required'),
  sectionId: z.coerce.number().int().positive('Course section is required'),
  title: z.string().min(3, 'Title must be at least 3 characters').max(100, 'Title is too long'),
  description: z.string().optional().default(''),
  finalDeadline: z.coerce.date().refine((d) => d > new Date(), {
    message: 'Final deadline must be in the future',
  }),
  studentIds: z.array(z.string().min(1)).min(1, 'At least one student must be selected'),
  mode: AssignmentModeSchema.default('individual'),
  status: z.literal('draft').default('draft'),
  overrideDueDates: z.array(OverrideDueDateSchema).optional(),
});

export const ListInstructorAssignmentsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional().default(''),
  termId: z.coerce.number().int().positive().optional(),
  courseId: z.coerce.number().int().positive().optional(),
  sectionId: z.coerce.number().int().positive().optional(),
  status: AssignmentStatusSchema.optional(),
});

export const AssignmentIdParamSchema = z.object({
  id: z.coerce.number().int().positive('Assignment ID must be a positive integer'),
});

export const CreateAssignmentInputSchema = CreateAssignmentSchema;

export const createAssignment = typedServerFn({
  method: 'POST',
})
  .middleware(serverFnMiddlewares(RATE_LIMITS.destructive))
  .inputValidator(CreateAssignmentSchema)
  .handler(async ({ data }) => {
    const { createAssignmentHandler } = await import('./assignments.server');
    return createAssignmentHandler({ data });
  });

export const listInstructorAssignments = typedServerFn({
  method: 'GET',
})
  .middleware(serverFnMiddlewares(RATE_LIMITS.standardRead))
  .inputValidator(ListInstructorAssignmentsSchema)
  .handler(async ({ data }) => {
    const { listInstructorAssignmentsHandler } = await import('./assignments.server');
    return listInstructorAssignmentsHandler({ data });
  });

export const getAssignmentDetail = typedServerFn({
  method: 'GET',
})
  .middleware(serverFnMiddlewares(RATE_LIMITS.standardRead))
  .inputValidator(AssignmentIdParamSchema)
  .handler(async ({ data }) => {
    const { getAssignmentDetailHandler } = await import('./assignments.server');
    return getAssignmentDetailHandler({ data });
  });

export const TransitionAssignmentStatusSchema = z.object({
  assignmentId: z.coerce.number().int().positive('Assignment ID must be a positive integer'),
  status: AssignmentStatusSchema,
});

export const transitionAssignmentStatus = typedServerFn({
  method: 'POST',
})
  .middleware(serverFnMiddlewares(RATE_LIMITS.destructive))
  .inputValidator(TransitionAssignmentStatusSchema)
  .handler(async ({ data }) => {
    const { transitionAssignmentStatusHandler } = await import('./assignments.server');
    return transitionAssignmentStatusHandler({ data });
  });

export const CloneAssignmentSchema = z.object({
  sourceAssignmentId: z.coerce
    .number()
    .int()
    .positive('Source assignment ID must be a positive integer'),
  targetSectionId: z.coerce.number().int().positive('Target course section is required'),
  title: z.string().min(3, 'Title must be at least 3 characters').max(100).optional(),
  description: z.string().max(5000).nullable().optional(),
  finalDeadline: z.coerce.date().refine((date) => date > new Date(), {
    message: 'Final deadline must be in the future',
  }),
  studentIds: z.array(z.string().min(1)).default([]),
});

export const cloneAssignment = typedServerFn({
  method: 'POST',
})
  .middleware(serverFnMiddlewares(RATE_LIMITS.destructive))
  .inputValidator(CloneAssignmentSchema)
  .handler(async ({ data }) => {
    const { cloneAssignmentHandler } = await import('./assignments.server');
    return cloneAssignmentHandler({ data });
  });

export const rolloverAssignment = typedServerFn({
  method: 'POST',
})
  .middleware(serverFnMiddlewares(RATE_LIMITS.destructive))
  .inputValidator(CloneAssignmentSchema)
  .handler(async ({ data }) => {
    const { rolloverAssignmentHandler } = await import('./assignments.server');
    return rolloverAssignmentHandler({ data });
  });

// ---- Student Assignment Schemas ----

export const ListStudentAssignmentsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional().default(''),
  termId: z.coerce.number().int().positive().optional(),
  courseId: z.coerce.number().int().positive().optional(),
  sectionId: z.coerce.number().int().positive().optional(),
  status: AssignmentStatusSchema.optional(),
});

export const StudentAssignmentIdParamSchema = z.object({
  id: z.coerce.number().int().positive('Assignment ID must be a positive integer'),
});

// ---- Student Assignment Server Function Stubs ----

export const listStudentAssignments = typedServerFn({
  method: 'GET',
})
  .middleware(serverFnMiddlewares(RATE_LIMITS.standardRead))
  .inputValidator(ListStudentAssignmentsSchema)
  .handler(async ({ data }) => {
    const { listStudentAssignmentsHandler } = await import('./assignments.server');
    return listStudentAssignmentsHandler({ data });
  });

export const getStudentAssignmentDetail = typedServerFn({
  method: 'GET',
})
  .middleware(serverFnMiddlewares(RATE_LIMITS.standardRead))
  .inputValidator(StudentAssignmentIdParamSchema)
  .handler(async ({ data }) => {
    const { getStudentAssignmentDetailHandler } = await import('./assignments.server');
    return getStudentAssignmentDetailHandler({ data });
  });

// ---- Manual Deadline Management Schemas ----

export const UnlockCheckpointSchema = z.object({
  checkpointId: z.coerce.number().int().positive('Checkpoint ID must be a positive integer'),
});

export const unlockCheckpoint = typedServerFn({
  method: 'POST',
})
  .middleware(serverFnMiddlewares(RATE_LIMITS.destructive))
  .inputValidator(UnlockCheckpointSchema)
  .handler(async ({ data }) => {
    const { unlockCheckpointHandler } = await import('./assignments.server');
    return unlockCheckpointHandler({ data });
  });

export const ExtendDeadlineSchema = z.object({
  checkpointId: z.coerce.number().int().positive('Checkpoint ID must be a positive integer'),
  newDueDate: z.coerce.date().refine((d) => d > new Date(), {
    message: 'New deadline must be in the future',
  }),
});

export const extendDeadline = typedServerFn({ method: 'POST' })
  .middleware(serverFnMiddlewares(RATE_LIMITS.destructive))
  .inputValidator(ExtendDeadlineSchema)
  .handler(async ({ data }) => {
    const { extendDeadlineHandler } = await import('./assignments.server');
    return extendDeadlineHandler({ data });
  });

// ---- Assignment Reassignment (Admin) ----

export const ReassignAssignmentSchema = z.object({
  assignmentId: z.coerce.number().int().positive('Assignment ID must be a positive integer'),
  newInstructorId: z.string().min(1, 'Instructor ID is required'),
});

export const reassignAssignment = typedServerFn({
  method: 'POST',
})
  .middleware(serverFnMiddlewares(RATE_LIMITS.destructive))
  .inputValidator(ReassignAssignmentSchema)
  .handler(async ({ data }) => {
    const { reassignAssignmentHandler } = await import('./assignments.server');
    return reassignAssignmentHandler({ data });
  });
