// Client-safe server function wrappers (Zod schemas + createServerFn stubs)
// Handler implementations are in assignments.server.ts (not bundled for client)
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

export const CreateAssignmentSchema = z.object({
  templateId: z.coerce.number().int().positive('Template is required'),
  title: z.string().min(3, 'Title must be at least 3 characters').max(100, 'Title is too long'),
  description: z.string().optional().default(''),
  finalDeadline: z.coerce.date().refine((d) => d > new Date(), {
    message: 'Final deadline must be in the future',
  }),
  studentIds: z.array(z.string().min(1)).min(1, 'At least one student must be selected'),
});

export const ListInstructorAssignmentsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional().default(''),
});

export const AssignmentIdParamSchema = z.object({
  id: z.coerce.number().int().positive('Assignment ID must be a positive integer'),
});

export const createAssignment = createServerFn({ method: 'POST' }).handler(
  async (args: { data: any }) => {
    const { createAssignmentHandler } = await import('./assignments.server');
    const data = CreateAssignmentSchema.parse(args.data);
    return createAssignmentHandler({ data });
  },
);

export const listInstructorAssignments = createServerFn({ method: 'GET' }).handler(
  async (args: { data: any }) => {
    const { listInstructorAssignmentsHandler } = await import('./assignments.server');
    const data = ListInstructorAssignmentsSchema.parse(args.data);
    return listInstructorAssignmentsHandler({ data });
  },
);

export const getAssignmentDetail = createServerFn({ method: 'GET' }).handler(
  async (args: { data: any }) => {
    const { getAssignmentDetailHandler } = await import('./assignments.server');
    const data = AssignmentIdParamSchema.parse(args.data);
    return getAssignmentDetailHandler({ data });
  },
);

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

export const listStudentAssignments = createServerFn({ method: 'GET' }).handler(
  async (args: { data: any }) => {
    const { listStudentAssignmentsHandler } = await import('./assignments.server');
    const data = ListStudentAssignmentsSchema.parse(args.data);
    return listStudentAssignmentsHandler({ data });
  },
);

export const getStudentAssignmentDetail = createServerFn({ method: 'GET' }).handler(
  async (args: { data: any }) => {
    const { getStudentAssignmentDetailHandler } = await import('./assignments.server');
    const data = StudentAssignmentIdParamSchema.parse(args.data);
    return getStudentAssignmentDetailHandler({ data });
  },
);

// ---- Manual Deadline Management Schemas ----

export const UnlockCheckpointSchema = z.object({
  checkpointId: z.coerce.number().int().positive('Checkpoint ID must be a positive integer'),
});

export const unlockCheckpoint = createServerFn({ method: 'POST' }).handler(
  async (args: { data: any }) => {
    const { unlockCheckpointHandler } = await import('./assignments.server');
    const data = UnlockCheckpointSchema.parse(args.data);
    return unlockCheckpointHandler({ data });
  },
);

export const ExtendDeadlineSchema = z.object({
  checkpointId: z.coerce.number().int().positive('Checkpoint ID must be a positive integer'),
  newDueDate: z.coerce.date().refine((d) => d > new Date(), {
    message: 'New deadline must be in the future',
  }),
});

export const extendDeadline = createServerFn({ method: 'POST' }).handler(
  async (args: { data: any }) => {
    const { extendDeadlineHandler } = await import('./assignments.server');
    const data = ExtendDeadlineSchema.parse(args.data);
    return extendDeadlineHandler({ data });
  },
);
