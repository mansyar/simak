// Client-safe server function wrappers (Zod schemas + createServerFn stubs)
// Handler implementations are in consultations.server.ts (not bundled for client)
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

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

export const logConsultation = createServerFn({ method: 'POST' })
  .inputValidator(LogConsultationSchema)
  .handler(async ({ data }) => {
    const { logConsultationHandler } = await import('./consultations.server');
    return logConsultationHandler({ data });
  });

export const listConsultations = createServerFn({ method: 'GET' })
  .inputValidator(ListConsultationsSchema)
  .handler(async ({ data }) => {
    const { listConsultationsHandler } = await import('./consultations.server');
    return listConsultationsHandler({ data });
  });

export const listPendingConsultations = createServerFn({ method: 'GET' })
  .inputValidator(ListPendingConsultationsSchema)
  .handler(async ({ data }) => {
    const { listPendingConsultationsHandler } = await import('./consultations.server');
    return listPendingConsultationsHandler({ data });
  });

export const verifyConsultation = createServerFn({ method: 'POST' })
  .inputValidator(VerifyConsultationSchema)
  .handler(async ({ data }) => {
    const { verifyConsultationHandler } = await import('./consultations.server');
    return verifyConsultationHandler({ data });
  });

export const rejectConsultation = createServerFn({ method: 'POST' })
  .inputValidator(RejectConsultationSchema)
  .handler(async ({ data }) => {
    const { rejectConsultationHandler } = await import('./consultations.server');
    return rejectConsultationHandler({ data });
  });

export const getConsultationDetail = createServerFn({ method: 'GET' })
  .inputValidator(GetConsultationDetailSchema)
  .handler(async ({ data }) => {
    const { getConsultationDetailHandler } = await import('./consultations.server');
    return getConsultationDetailHandler({ data });
  });

export const listVerifiedCounts = createServerFn({ method: 'GET' })
  .inputValidator(ListVerifiedCountsSchema)
  .handler(async ({ data }) => {
    const { listVerifiedCountsHandler } = await import('./consultations.server');
    return listVerifiedCountsHandler({ data });
  });
