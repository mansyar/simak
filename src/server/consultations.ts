// Client-safe server function wrappers (Zod schemas + typedServerFn stubs)
// Handler implementations are in consultations.server.ts (not bundled for client)
import { RATE_LIMITS } from '@/lib/rate-limiter';
import { serverFnMiddlewares, typedServerFn } from '@/lib/server-fn';
import { z } from 'zod';
import {
  getConsultationDetailHandler,
  listConsultationsHandler,
  listPendingConsultationsHandler,
  listVerifiedCountsHandler,
  logConsultationHandler,
  rejectConsultationHandler,
  verifyConsultationHandler,
} from './consultations.server';

export const LogConsultationSchema = z.object({
  checkpointId: z.coerce.number().int().positive('Checkpoint ID must be a positive integer'),
  sessionType: z.enum(['internal', 'external'], {
    message: 'Session type must be internal or external',
  }),
  externalConsultantName: z.string().optional(),
  notes: z.string().min(1, 'Notes are required'),
});

export const ListConsultationsSchema = z.object({
  assignmentId: z.coerce.number().int().positive('Assignment ID must be a positive integer'),
  checkpointId: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const ListPendingConsultationsSchema = z.object({
  assignmentId: z.coerce.number().int().positive('Assignment ID must be a positive integer'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const VerifyConsultationSchema = z.object({
  consultationId: z.coerce.number().int().positive('Consultation ID must be a positive integer'),
});

export const RejectConsultationSchema = z.object({
  consultationId: z.coerce.number().int().positive('Consultation ID must be a positive integer'),
  reason: z.string().min(1, 'Rejection reason is required'),
});

export const GetConsultationDetailSchema = z.object({
  consultationId: z.coerce.number().int().positive('Consultation ID must be a positive integer'),
});

export const ListVerifiedCountsSchema = z.object({
  assignmentId: z.coerce.number().int().positive('Assignment ID must be a positive integer'),
});

export const logConsultation = typedServerFn({ method: 'POST' })
  .middleware(serverFnMiddlewares(RATE_LIMITS.destructive))
  .inputValidator(LogConsultationSchema)
  .handler(async ({ data }) => {
    return logConsultationHandler({ data });
  });

export const listConsultations = typedServerFn({
  method: 'GET',
})
  .middleware(serverFnMiddlewares(RATE_LIMITS.standardRead))
  .inputValidator(ListConsultationsSchema)
  .handler(async ({ data }) => {
    return listConsultationsHandler({ data });
  });

export const listPendingConsultations = typedServerFn({
  method: 'GET',
})
  .middleware(serverFnMiddlewares(RATE_LIMITS.standardRead))
  .inputValidator(ListPendingConsultationsSchema)
  .handler(async ({ data }) => {
    return listPendingConsultationsHandler({ data });
  });

export const verifyConsultation = typedServerFn({
  method: 'POST',
})
  .middleware(serverFnMiddlewares(RATE_LIMITS.destructive))
  .inputValidator(VerifyConsultationSchema)
  .handler(async ({ data }) => {
    return verifyConsultationHandler({ data });
  });

export const rejectConsultation = typedServerFn({
  method: 'POST',
})
  .middleware(serverFnMiddlewares(RATE_LIMITS.destructive))
  .inputValidator(RejectConsultationSchema)
  .handler(async ({ data }) => {
    return rejectConsultationHandler({ data });
  });

export const getConsultationDetail = typedServerFn({
  method: 'GET',
})
  .middleware(serverFnMiddlewares(RATE_LIMITS.standardRead))
  .inputValidator(GetConsultationDetailSchema)
  .handler(async ({ data }) => {
    return getConsultationDetailHandler({ data });
  });

export const listVerifiedCounts = typedServerFn({
  method: 'GET',
})
  .middleware(serverFnMiddlewares(RATE_LIMITS.standardRead))
  .inputValidator(ListVerifiedCountsSchema)
  .handler(async ({ data }) => {
    return listVerifiedCountsHandler({ data });
  });
