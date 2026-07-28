// Client-safe server function wrappers (Zod schemas + typedServerFn stubs)
// Handler implementations are in templates.server.ts (not bundled for client)
import { typedServerFn } from '@/lib/server-fn';
import { z } from 'zod';
import type { ServerError } from '@/lib/errors';

export const CheckpointInputSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
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
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const listTemplates = typedServerFn({ method: 'GET' })
  .inputValidator(ListTemplatesSchema)
  .handler(async ({ data }) => {
    const { listTemplatesHandler } = await import('./templates.server');
    return listTemplatesHandler({ data });
  });

export const getTemplate = typedServerFn({ method: 'GET' })
  .inputValidator(TemplateIdParamSchema)
  .handler(async ({ data }) => {
    const { getTemplateHandler } = await import('./templates.server');
    return getTemplateHandler({ data });
  });

export const createTemplate = typedServerFn({ method: 'POST' })
  .inputValidator(CreateTemplateSchema)
  .handler(async ({ data }) => {
    const { createTemplateHandler } = await import('./templates.server');
    return createTemplateHandler({ data });
  });

export const updateTemplate = typedServerFn({ method: 'POST' })
  .inputValidator(UpdateTemplateSchema.extend({ id: z.coerce.number().int().positive() }))
  .handler(async ({ data }) => {
    const { updateTemplateHandler } = await import('./templates.server');
    return updateTemplateHandler({ data });
  });

export const deleteTemplate = typedServerFn({ method: 'POST' })
  .inputValidator(TemplateIdParamSchema)
  .handler(async ({ data }) => {
    const { deleteTemplateHandler } = await import('./templates.server');
    return deleteTemplateHandler({ data });
  });

export const duplicateTemplate = typedServerFn({ method: 'POST' })
  .inputValidator(TemplateIdParamSchema)
  .handler(async ({ data }) => {
    const { duplicateTemplateHandler } = await import('./templates.server');
    return duplicateTemplateHandler({ data });
  });

export const listTemplateAssignments = typedServerFn({ method: 'GET' })
  .inputValidator(ListTemplateAssignmentsSchema)
  .handler(async ({ data }) => {
    const { listTemplateAssignmentsHandler } = await import('./templates.server');
    return listTemplateAssignmentsHandler({ data });
  });

// ── Return types (for consumers that call via useServerFn) ───────────

export interface TemplateListItem {
  id: number;
  name: string;
  type: string;
  createdBy: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  checkpointCount: number;
  checkpoints: string[];
}

export interface TemplateDetail {
  id: number;
  name: string;
  type: string;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  checkpoints: {
    id: number;
    name: string;
    order: number;
    minConsultations: number | null;
    estimatedDuration: number | null;
    gradingType: 'numeric' | 'qualitative' | null;
  }[];
  assignmentCount: number;
}

export interface TemplateAssignment {
  id: number;
  title: string;
  instructorName: string;
  studentCount: number;
  createdAt: Date | null;
}

export type GetTemplateResult = TemplateDetail | null | ServerError;

export type DeleteTemplateResult = { success: true } | ServerError;

export type DuplicateTemplateResult = { template: TemplateDetail } | ServerError;

export type CreateTemplateResult = { template: TemplateDetail } | ServerError;
