// Client-safe server function wrappers (Zod schemas + createServerFn stubs)
// Handler implementations are in extensions.server.ts (not bundled for client)
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

export const RequestExtensionSchema = z.object({
  assignmentId: z.coerce.number().int().positive('Assignment ID must be a positive integer'),
  checkpointId: z.coerce.number().int().positive().optional(),
  category: z.enum(['personal', 'research', 'health', 'other'], {
    message: 'Category must be one of: personal, research, health, other',
  }),
  reason: z.string().min(10, 'Reason must be at least 10 characters'),
  extensionDays: z.coerce
    .number()
    .int()
    .min(1, 'Extension days must be at least 1')
    .max(30, 'Extension days cannot exceed 30'),
});

export const ListExtensionRequestsSchema = z.object({
  assignmentId: z.coerce.number().int().positive('Assignment ID must be a positive integer'),
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const ApproveExtensionSchema = z.object({
  requestId: z.coerce.number().int().positive('Request ID must be a positive integer'),
  resolutionReason: z.string().optional(),
});

export const RejectExtensionSchema = z.object({
  requestId: z.coerce.number().int().positive('Request ID must be a positive integer'),
  resolutionReason: z.string().min(20, 'Resolution reason must be at least 20 characters'),
});

export const ListMyExtensionsSchema = z.object({
  assignmentId: z.coerce.number().int().positive('Assignment ID must be a positive integer'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const BulkExtendSchema = z.object({
  assignmentId: z.coerce.number().int().positive('Assignment ID must be a positive integer'),
  studentId: z.string().min(1, 'Student ID is required'),
  extraDays: z.coerce.number().int().positive('Extra days must be a positive integer'),
  reason: z.string().min(1, 'Reason is required'),
});

// ---- Server Function Stubs ----

export const requestExtension = createServerFn({ method: 'POST' })
  .inputValidator(RequestExtensionSchema)
  .handler(async ({ data }) => {
    const { requestExtensionHandler } = await import('./extensions.server');
    return requestExtensionHandler({ data });
  });

export const listExtensionRequests = createServerFn({ method: 'GET' })
  .inputValidator(ListExtensionRequestsSchema)
  .handler(async ({ data }) => {
    const { listExtensionRequestsHandler } = await import('./extensions.server');
    return listExtensionRequestsHandler({ data });
  });

export const listMyExtensionRequests = createServerFn({ method: 'GET' })
  .inputValidator(ListMyExtensionsSchema)
  .handler(async ({ data }) => {
    const { listMyExtensionRequestsHandler } = await import('./extensions.server');
    return listMyExtensionRequestsHandler({ data });
  });

export const approveExtension = createServerFn({ method: 'POST' })
  .inputValidator(ApproveExtensionSchema)
  .handler(async ({ data }) => {
    const { approveExtensionHandler } = await import('./extensions.server');
    return approveExtensionHandler({ data });
  });

export const rejectExtension = createServerFn({ method: 'POST' })
  .inputValidator(RejectExtensionSchema)
  .handler(async ({ data }) => {
    const { rejectExtensionHandler } = await import('./extensions.server');
    return rejectExtensionHandler({ data });
  });

export const bulkExtend = createServerFn({ method: 'POST' })
  .inputValidator(BulkExtendSchema)
  .handler(async ({ data }) => {
    const { bulkExtendHandler } = await import('./extensions.server');
    return bulkExtendHandler({ data });
  });
