// Client-safe server function wrappers (Zod schemas + typedServerFn stubs)
// Handler implementations are in assignments.server.ts (not bundled for client)
import { RATE_LIMITS } from '@/lib/rate-limiter';
import { typedServerFn } from '@/lib/server-fn';
import { z } from 'zod';

export const OverrideDueDateSchema = z.object({
  checkpointOrder: z.coerce.number().int().positive('Checkpoint order must be positive'),
  dueDate: z.coerce.date(),
});

export const CreateAssignmentSchema = z.object({
  templateId: z.coerce.number().int().positive('Template is required'),
  title: z.string().min(3, 'Title must be at least 3 characters').max(100, 'Title is too long'),
  description: z.string().optional().default(''),
  finalDeadline: z.coerce.date().refine((d) => d > new Date(), {
    message: 'Final deadline must be in the future',
  }),
  studentIds: z.array(z.string().min(1)).min(1, 'At least one student must be selected'),
  overrideDueDates: z.array(OverrideDueDateSchema).optional(),
});

export const ListInstructorAssignmentsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional().default(''),
});

export const AssignmentIdParamSchema = z.object({
  id: z.coerce.number().int().positive('Assignment ID must be a positive integer'),
});

export const CreateAssignmentInputSchema = CreateAssignmentSchema;

export const createAssignment = typedServerFn({
  method: 'POST',
  rateLimit: RATE_LIMITS.destructive,
})
  .inputValidator(CreateAssignmentSchema)
  .handler(async ({ data }) => {
    const { createAssignmentHandler } = await import('./assignments.server');
    return createAssignmentHandler({ data });
  });

export const listInstructorAssignments = typedServerFn({
  method: 'GET',
  rateLimit: RATE_LIMITS.standardRead,
})
  .inputValidator(ListInstructorAssignmentsSchema)
  .handler(async ({ data }) => {
    const { listInstructorAssignmentsHandler } = await import('./assignments.server');
    return listInstructorAssignmentsHandler({ data });
  });

export const getAssignmentDetail = typedServerFn({
  method: 'GET',
  rateLimit: RATE_LIMITS.standardRead,
})
  .inputValidator(AssignmentIdParamSchema)
  .handler(async ({ data }) => {
    const { getAssignmentDetailHandler } = await import('./assignments.server');
    return getAssignmentDetailHandler({ data });
  });

// ---- Student Assignment Schemas ----

export const ListStudentAssignmentsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional().default(''),
});

export const StudentAssignmentIdParamSchema = z.object({
  id: z.coerce.number().int().positive('Assignment ID must be a positive integer'),
});

// ---- Student Assignment Server Function Stubs ----

export const listStudentAssignments = typedServerFn({
  method: 'GET',
  rateLimit: RATE_LIMITS.standardRead,
})
  .inputValidator(ListStudentAssignmentsSchema)
  .handler(async ({ data }) => {
    const { listStudentAssignmentsHandler } = await import('./assignments.server');
    return listStudentAssignmentsHandler({ data });
  });

export const getStudentAssignmentDetail = typedServerFn({
  method: 'GET',
  rateLimit: RATE_LIMITS.standardRead,
})
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
  rateLimit: RATE_LIMITS.destructive,
})
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

export const extendDeadline = typedServerFn({ method: 'POST', rateLimit: RATE_LIMITS.destructive })
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
  rateLimit: RATE_LIMITS.destructive,
})
  .inputValidator(ReassignAssignmentSchema)
  .handler(async ({ data }) => {
    const { reassignAssignmentHandler } = await import('./assignments.server');
    return reassignAssignmentHandler({ data });
  });
