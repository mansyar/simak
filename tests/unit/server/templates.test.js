/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import {
  CreateTemplateSchema,
  ListTemplatesSchema,
  TemplateIdParamSchema,
  ListTemplateAssignmentsSchema,
} from '@/server/templates';
describe('Template server functions - Schemas', () => {
  describe('CreateTemplateSchema', () => {
    it('should accept valid input with defaults', () => {
      const result = CreateTemplateSchema.safeParse({
        name: 'Thesis Template',
        type: 'Thesis',
        checkpoints: [{ name: 'Chapter 1' }, { name: 'Chapter 2' }, { name: 'Chapter 3' }],
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.checkpoints[0]).toEqual({
          name: 'Chapter 1',
          minConsultations: 0,
          estimatedDuration: 7,
        });
      }
    });
    it('should accept explicit minConsultations', () => {
      const result = CreateTemplateSchema.safeParse({
        name: 'Thesis Template',
        type: 'Thesis',
        checkpoints: [{ name: 'Chapter 1', minConsultations: 3, estimatedDuration: 7 }],
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.checkpoints[0].minConsultations).toBe(3);
      }
    });
    it('should reject empty name', () => {
      const result = CreateTemplateSchema.safeParse({
        name: '',
        type: 'Thesis',
        checkpoints: [{ name: 'Chapter 1' }],
      });
      expect(result.success).toBe(false);
    });
    it('should reject missing type', () => {
      const result = CreateTemplateSchema.safeParse({
        name: 'Thesis',
        type: '',
        checkpoints: [{ name: 'Chapter 1' }],
      });
      expect(result.success).toBe(false);
    });
    it('should reject zero checkpoints', () => {
      const result = CreateTemplateSchema.safeParse({
        name: 'Thesis',
        type: 'Thesis',
        checkpoints: [],
      });
      expect(result.success).toBe(false);
    });
    it('should reject empty checkpoint name', () => {
      const result = CreateTemplateSchema.safeParse({
        name: 'Thesis',
        type: 'Thesis',
        checkpoints: [{ name: 'Chapter 1' }, { name: '' }],
      });
      expect(result.success).toBe(false);
    });
    it('should coerce string minConsultations to number', () => {
      const result = CreateTemplateSchema.safeParse({
        name: 'Thesis',
        type: 'Thesis',
        checkpoints: [{ name: 'Ch 1', minConsultations: '5', estimatedDuration: 7 }],
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.checkpoints[0].minConsultations).toBe(5);
      }
    });
  });
  describe('ListTemplatesSchema', () => {
    it('should use defaults for optional fields', () => {
      const result = ListTemplatesSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(20);
        expect(result.data.search).toBe('');
      }
    });
    it('should coerce string page number', () => {
      const result = ListTemplatesSchema.safeParse({ page: '3' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(3);
      }
    });
  });
  describe('TemplateIdParamSchema', () => {
    it('should coerce string id to number', () => {
      const result = TemplateIdParamSchema.safeParse({ id: '42' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe(42);
      }
    });
    it('should accept numeric id', () => {
      const result = TemplateIdParamSchema.safeParse({ id: 42 });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe(42);
      }
    });
    it('should reject non-numeric id', () => {
      const result = TemplateIdParamSchema.safeParse({ id: 'abc' });
      expect(result.success).toBe(false);
    });
  });
  describe('ListTemplateAssignmentsSchema', () => {
    it('should coerce string templateId to number', () => {
      const result = ListTemplateAssignmentsSchema.safeParse({ templateId: '5' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.templateId).toBe(5);
      }
    });
    it('should accept numeric templateId', () => {
      const result = ListTemplateAssignmentsSchema.safeParse({ templateId: 5 });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.templateId).toBe(5);
      }
    });
    it('should reject non-numeric templateId', () => {
      const result = ListTemplateAssignmentsSchema.safeParse({ templateId: 'abc' });
      expect(result.success).toBe(false);
    });
    it('should reject zero templateId', () => {
      const result = ListTemplateAssignmentsSchema.safeParse({ templateId: 0 });
      expect(result.success).toBe(false);
    });
  });
});
