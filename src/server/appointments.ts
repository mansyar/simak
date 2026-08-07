// Client-safe server function wrappers. Handler implementations live in appointments.server.ts.
import { RATE_LIMITS } from '@/lib/rate-limiter';
import { appointmentStatusSchema, appointmentWindowSchema } from '@/lib/appointment-policies';
import { serverFnMiddlewares, typedServerFn } from '@/lib/server-fn';
import { z } from 'zod';

const positiveId = z.coerce.number().int().positive();

export const AppointmentIdSchema = z.object({
  appointmentId: positiveId,
});

export const CreateAppointmentSlotSchema = z.object({
  assignmentId: positiveId,
  checkpointId: positiveId.optional(),
  ...appointmentWindowSchema.shape,
});

export const ListInstructorAppointmentsSchema = z.object({
  assignmentId: positiveId,
  status: appointmentStatusSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const ListAvailableAppointmentsSchema = z.object({
  assignmentId: positiveId,
  checkpointId: positiveId.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const ListStudentAppointmentsSchema = z.object({
  assignmentId: positiveId.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const BookAppointmentSchema = AppointmentIdSchema.extend({
  checkpointId: positiveId.optional(),
});

export const CancelAppointmentSchema = AppointmentIdSchema.extend({
  reason: z.string().trim().min(1).max(500).optional(),
});

export const RescheduleAppointmentSchema = AppointmentIdSchema.extend({
  replacementAppointmentId: positiveId,
});

export const CompleteAppointmentSchema = AppointmentIdSchema;
export const MarkAppointmentNoShowSchema = AppointmentIdSchema;

export const createAppointmentSlot = typedServerFn({ method: 'POST' })
  .middleware(serverFnMiddlewares(RATE_LIMITS.destructive))
  .inputValidator(CreateAppointmentSlotSchema)
  .handler(async ({ data }) => {
    const { createAppointmentSlotHandler } = await import('./appointments.server');
    return createAppointmentSlotHandler({ data });
  });

export const listInstructorAppointments = typedServerFn({ method: 'GET' })
  .middleware(serverFnMiddlewares(RATE_LIMITS.standardRead))
  .inputValidator(ListInstructorAppointmentsSchema)
  .handler(async ({ data }) => {
    const { listInstructorAppointmentsHandler } = await import('./appointments.server');
    return listInstructorAppointmentsHandler({ data });
  });

export const cancelAppointment = typedServerFn({ method: 'POST' })
  .middleware(serverFnMiddlewares(RATE_LIMITS.destructive))
  .inputValidator(CancelAppointmentSchema)
  .handler(async ({ data }) => {
    const { cancelAppointmentHandler } = await import('./appointments.server');
    return cancelAppointmentHandler({ data });
  });

export const listAvailableAppointments = typedServerFn({ method: 'GET' })
  .middleware(serverFnMiddlewares(RATE_LIMITS.standardRead))
  .inputValidator(ListAvailableAppointmentsSchema)
  .handler(async ({ data }) => {
    const { listAvailableAppointmentsHandler } = await import('./appointments.server');
    return listAvailableAppointmentsHandler({ data });
  });

export const listStudentAppointments = typedServerFn({ method: 'GET' })
  .middleware(serverFnMiddlewares(RATE_LIMITS.standardRead))
  .inputValidator(ListStudentAppointmentsSchema)
  .handler(async ({ data }) => {
    const { listStudentAppointmentsHandler } = await import('./appointments.server');
    return listStudentAppointmentsHandler({ data });
  });

export const bookAppointment = typedServerFn({ method: 'POST' })
  .middleware(serverFnMiddlewares(RATE_LIMITS.destructive))
  .inputValidator(BookAppointmentSchema)
  .handler(async ({ data }) => {
    const { bookAppointmentHandler } = await import('./appointments.server');
    return bookAppointmentHandler({ data });
  });

export const rescheduleAppointment = typedServerFn({ method: 'POST' })
  .middleware(serverFnMiddlewares(RATE_LIMITS.destructive))
  .inputValidator(RescheduleAppointmentSchema)
  .handler(async ({ data }) => {
    const { rescheduleAppointmentHandler } = await import('./appointments.server');
    return rescheduleAppointmentHandler({ data });
  });

export const completeAppointment = typedServerFn({ method: 'POST' })
  .middleware(serverFnMiddlewares(RATE_LIMITS.destructive))
  .inputValidator(CompleteAppointmentSchema)
  .handler(async ({ data }) => {
    const { completeAppointmentHandler } = await import('./appointments.server');
    return completeAppointmentHandler({ data });
  });

export const markAppointmentNoShow = typedServerFn({ method: 'POST' })
  .middleware(serverFnMiddlewares(RATE_LIMITS.destructive))
  .inputValidator(MarkAppointmentNoShowSchema)
  .handler(async ({ data }) => {
    const { markAppointmentNoShowHandler } = await import('./appointments.server');
    return markAppointmentNoShowHandler({ data });
  });

export const getAppointmentDetail = typedServerFn({ method: 'GET' })
  .middleware(serverFnMiddlewares(RATE_LIMITS.standardRead))
  .inputValidator(AppointmentIdSchema)
  .handler(async ({ data }) => {
    const { getAppointmentDetailHandler } = await import('./appointments.server');
    return getAppointmentDetailHandler({ data });
  });
