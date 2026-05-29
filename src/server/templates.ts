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

export const listTemplates = createServerFn({ method: 'GET' }).handler(
  async (args: { data: unknown }) => {
    const { listTemplatesHandler } = await import('./templates.server');
    const data = ListTemplatesSchema.parse(args.data);
    return listTemplatesHandler({ data });
  },
);

export const getTemplate = createServerFn({ method: 'GET' }).handler(
  async (args: { data: unknown }) => {
    const { getTemplateHandler } = await import('./templates.server');
    const data = TemplateIdParamSchema.parse(args.data);
    return getTemplateHandler({ data });
  },
);

export const createTemplate = createServerFn({ method: 'POST' }).handler(
  async (args: { data: unknown }) => {
    const { createTemplateHandler } = await import('./templates.server');
    const data = CreateTemplateSchema.parse(args.data);
    return createTemplateHandler({ data });
  },
);

export const updateTemplate = createServerFn({ method: 'POST' }).handler(
  async (args: { data: unknown }) => {
    const { updateTemplateHandler } = await import('./templates.server');
    const data = UpdateTemplateSchema.extend({ id: z.coerce.number().int().positive() }).parse(
      args.data,
    );
    return updateTemplateHandler({ data });
  },
);

export const deleteTemplate = createServerFn({ method: 'POST' }).handler(
  async (args: { data: unknown }) => {
    const { deleteTemplateHandler } = await import('./templates.server');
    const data = TemplateIdParamSchema.parse(args.data);
    return deleteTemplateHandler({ data });
  },
);

export const duplicateTemplate = createServerFn({ method: 'POST' }).handler(
  async (args: { data: unknown }) => {
    const { duplicateTemplateHandler } = await import('./templates.server');
    const data = TemplateIdParamSchema.parse(args.data);
    return duplicateTemplateHandler({ data });
  },
);
