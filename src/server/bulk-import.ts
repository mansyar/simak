// Client-safe server function wrappers (Zod schemas + createServerFn stubs)
// Handler implementations are in bulk-import.server.ts (not bundled for client)
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

const VALID_CREATE_ROLES = ['admin', 'instructor', 'student'] as const;

export const BulkUserRowSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  role: z.enum(VALID_CREATE_ROLES, { message: 'Invalid role' }),
});

export const BulkCreateUsersSchema = z.object({
  rows: z.array(BulkUserRowSchema).min(1, 'At least one row required'),
});

export const BulkTemplateRowSchema = z.object({
  templateName: z.string().min(1, 'Template name is required'),
  type: z.string().min(1, 'Type is required'),
  checkpointName: z.string().min(1, 'Checkpoint name is required'),
  minConsultations: z.coerce.number().int().min(0).default(0),
  estimatedDuration: z.coerce.number().int().min(1).default(7),
});

export const BulkCreateTemplatesSchema = z.object({
  rows: z.array(BulkTemplateRowSchema).min(1, 'At least one row required'),
});

export const bulkCreateUsers = createServerFn({ method: 'POST' })
  .inputValidator(BulkCreateUsersSchema)
  .handler(async ({ data }) => {
    const { bulkCreateUsersHandler } = await import('./bulk-import.server');
    return bulkCreateUsersHandler({ data });
  });

export const bulkCreateTemplates = createServerFn({ method: 'POST' })
  .inputValidator(BulkCreateTemplatesSchema)
  .handler(async ({ data }) => {
    const { bulkCreateTemplatesHandler } = await import('./bulk-import.server');
    return bulkCreateTemplatesHandler({ data });
  });
