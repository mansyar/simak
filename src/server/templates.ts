// Client-safe server function wrappers (Zod schemas + createServerFn stubs)
// Handler implementations are in templates.server.ts (not bundled for client)
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

export const CheckpointInputSchema = z.object({
  name: z.string().min(1, 'Checkpoint name is required'),
  minConsultations: z.coerce.number().int().min(0).default(0),
  estimatedDuration: z.coerce.number().int().min(0).default(7),
});

export const CreateTemplateSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.string().min(1, 'Type is required'),
  checkpoints: z.array(CheckpointInputSchema).min(1, 'At least one checkpoint is required'),
});

export const UpdateTemplateSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.string().min(1, 'Type is required'),
  checkpoints: z.array(CheckpointInputSchema).min(1, 'At least one checkpoint is required'),
});

export const ListTemplatesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional().default(''),
  type: z.string().optional().default(''),
});

export const TemplateIdParamSchema = z.object({
  id: z.coerce.number().int().positive('Template ID must be a positive integer'),
});

export const ListTemplateAssignmentsSchema = z.object({
  templateId: z.coerce.number().int().positive('Template ID must be a positive integer'),
});

export const listTemplates = createServerFn({ method: 'GET' })
  .inputValidator(ListTemplatesSchema)
  .handler(async ({ data }) => {
    const { listTemplatesHandler } = await import('./templates.server');
    return listTemplatesHandler({ data });
  });

export const getTemplate = createServerFn({ method: 'GET' })
  .inputValidator(TemplateIdParamSchema)
  .handler(async ({ data }) => {
    const { getTemplateHandler } = await import('./templates.server');
    return getTemplateHandler({ data });
  });

export const createTemplate = createServerFn({ method: 'POST' })
  .inputValidator(CreateTemplateSchema)
  .handler(async ({ data }) => {
    const { createTemplateHandler } = await import('./templates.server');
    return createTemplateHandler({ data });
  });

export const updateTemplate = createServerFn({ method: 'POST' })
  .inputValidator(UpdateTemplateSchema.extend({ id: z.coerce.number().int().positive() }))
  .handler(async ({ data }) => {
    const { updateTemplateHandler } = await import('./templates.server');
    return updateTemplateHandler({ data });
  });

export const deleteTemplate = createServerFn({ method: 'POST' })
  .inputValidator(TemplateIdParamSchema)
  .handler(async ({ data }) => {
    const { deleteTemplateHandler } = await import('./templates.server');
    return deleteTemplateHandler({ data });
  });

export const duplicateTemplate = createServerFn({ method: 'POST' })
  .inputValidator(TemplateIdParamSchema)
  .handler(async ({ data }) => {
    const { duplicateTemplateHandler } = await import('./templates.server');
    return duplicateTemplateHandler({ data });
  });

export const listTemplateAssignments = createServerFn({ method: 'GET' })
  .inputValidator(ListTemplateAssignmentsSchema)
  .handler(async ({ data }) => {
    const { listTemplateAssignmentsHandler } = await import('./templates.server');
    return listTemplateAssignmentsHandler({ data });
  });
