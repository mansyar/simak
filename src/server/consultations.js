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
export const logConsultation = createServerFn({ method: 'POST' }).handler(async (args) => {
  const { logConsultationHandler } = await import('./consultations.server');
  const data = LogConsultationSchema.parse(args.data);
  return logConsultationHandler({ data });
});
export const listConsultations = createServerFn({ method: 'GET' }).handler(async (args) => {
  const { listConsultationsHandler } = await import('./consultations.server');
  const data = ListConsultationsSchema.parse(args.data);
  return listConsultationsHandler({ data });
});
export const listPendingConsultations = createServerFn({ method: 'GET' }).handler(async (args) => {
  const { listPendingConsultationsHandler } = await import('./consultations.server');
  const data = ListPendingConsultationsSchema.parse(args.data);
  return listPendingConsultationsHandler({ data });
});
export const verifyConsultation = createServerFn({ method: 'POST' }).handler(async (args) => {
  const { verifyConsultationHandler } = await import('./consultations.server');
  const data = VerifyConsultationSchema.parse(args.data);
  return verifyConsultationHandler({ data });
});
export const rejectConsultation = createServerFn({ method: 'POST' }).handler(async (args) => {
  const { rejectConsultationHandler } = await import('./consultations.server');
  const data = RejectConsultationSchema.parse(args.data);
  return rejectConsultationHandler({ data });
});
export const getConsultationDetail = createServerFn({ method: 'GET' }).handler(async (args) => {
  const { getConsultationDetailHandler } = await import('./consultations.server');
  const data = GetConsultationDetailSchema.parse(args.data);
  return getConsultationDetailHandler({ data });
});
export const listVerifiedCounts = createServerFn({ method: 'GET' }).handler(async (args) => {
  const { listVerifiedCountsHandler } = await import('./consultations.server');
  const data = ListVerifiedCountsSchema.parse(args.data);
  return listVerifiedCountsHandler({ data });
});
