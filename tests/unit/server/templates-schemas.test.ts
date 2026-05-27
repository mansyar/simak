/** @vitest-environment node */
import { describe, it, expect, vi } from 'vitest';

// Mock createServerFn before importing
vi.mock('@tanstack/react-start', () => ({
  createServerFn: vi.fn().mockReturnValue({
    handler: vi.fn().mockImplementation((fn) => fn),
  }),
}));

import {
  CheckpointInputSchema,
  CreateTemplateSchema,
  UpdateTemplateSchema,
  ListTemplatesSchema,
  TemplateIdParamSchema,
} from '@/server/templates';

describe('Template Schemas', () => {
  describe('CheckpointInputSchema', () => {
    it('should accept valid checkpoint', () => {
      const result = CheckpointInputSchema.safeParse({
        name: 'Chapter 1',
        minConsultations: 2,
      });
      expect(result.success).toBe(true);
    });

    it('should use default minConsultations of 0', () => {
      const result = CheckpointInputSchema.safeParse({
        name: 'Chapter 1',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.minConsultations).toBe(0);
      }
    });

    it('should reject empty name', () => {
      const result = CheckpointInputSchema.safeParse({
        name: '',
        minConsultations: 0,
      });
      expect(result.success).toBe(false);
    });

    it('should reject negative minConsultations', () => {
      const result = CheckpointInputSchema.safeParse({
        name: 'Chapter 1',
        minConsultations: -1,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('CreateTemplateSchema', () => {
    it('should accept valid template', () => {
      const result = CreateTemplateSchema.safeParse({
        name: ' Thesis Template',
        type: 'thesis',
        checkpoints: [
          { name: 'Proposal', minConsultations: 1 },
          { name: 'Chapter 1', minConsultations: 2 },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty checkpoints array', () => {
      const result = CreateTemplateSchema.safeParse({
        name: 'Thesis Template',
        type: 'thesis',
        checkpoints: [],
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing name', () => {
      const result = CreateTemplateSchema.safeParse({
        type: 'thesis',
        checkpoints: [{ name: 'Proposal' }],
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing type', () => {
      const result = CreateTemplateSchema.safeParse({
        name: 'Thesis Template',
        checkpoints: [{ name: 'Proposal' }],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('UpdateTemplateSchema', () => {
    it('should accept valid template', () => {
      const result = UpdateTemplateSchema.safeParse({
        name: 'Updated Template',
        type: 'thesis',
        checkpoints: [{ name: 'New Checkpoint' }],
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty name', () => {
      const result = UpdateTemplateSchema.safeParse({
        name: '',
        type: 'thesis',
        checkpoints: [{ name: 'Checkpoint' }],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('ListTemplatesSchema', () => {
    it('should accept empty input with defaults', () => {
      const result = ListTemplatesSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(20);
        expect(result.data.search).toBe('');
        expect(result.data.type).toBe('');
      }
    });

    it('should accept custom filters', () => {
      const result = ListTemplatesSchema.safeParse({
        page: 2,
        limit: 50,
        search: 'thesis',
        type: 'thesis',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(2);
        expect(result.data.limit).toBe(50);
        expect(result.data.search).toBe('thesis');
        expect(result.data.type).toBe('thesis');
      }
    });

    it('should reject page less than 1', () => {
      const result = ListTemplatesSchema.safeParse({ page: 0 });
      expect(result.success).toBe(false);
    });

    it('should reject limit greater than 100', () => {
      const result = ListTemplatesSchema.safeParse({ limit: 101 });
      expect(result.success).toBe(false);
    });
  });

  describe('TemplateIdParamSchema', () => {
    it('should accept valid ID', () => {
      const result = TemplateIdParamSchema.safeParse({ id: 1 });
      expect(result.success).toBe(true);
    });

    it('should reject negative ID', () => {
      const result = TemplateIdParamSchema.safeParse({ id: -1 });
      expect(result.success).toBe(false);
    });

    it('should reject zero ID', () => {
      const result = TemplateIdParamSchema.safeParse({ id: 0 });
      expect(result.success).toBe(false);
    });
  });
});
