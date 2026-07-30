/** @vitest-environment node */
import { describe, it, expect, vi } from 'vitest';

// Mock createServerFn before importing
vi.mock('@tanstack/react-start', () => ({
  createServerFn: vi.fn().mockReturnValue({
    middleware: vi.fn().mockReturnThis(),
    inputValidator: vi.fn().mockReturnThis(),
    handler: vi.fn().mockImplementation((fn) => fn),
  }),
  createMiddleware: vi.fn().mockReturnValue({
    server: vi.fn().mockImplementation((fn) => fn),
  }),
}));

import {
  CreateCriterionSchema,
  UpdateCriterionSchema,
  CreateLevelSchema,
  UpdateLevelSchema,
  SaveRubricSchema,
  DeleteCriterionSchema,
  DeleteLevelSchema,
  GetRubricSchema,
} from '@/server/rubrics';

describe('Rubric Schemas', () => {
  describe('CreateCriterionSchema', () => {
    it('should accept valid criterion', () => {
      const result = CreateCriterionSchema.safeParse({
        templateCheckpointId: 1,
        title: 'Code Quality',
        description: 'Assesses code readability',
        weight: 50,
        order: 0,
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty title', () => {
      const result = CreateCriterionSchema.safeParse({
        templateCheckpointId: 1,
        title: '',
        weight: 50,
        order: 0,
      });
      expect(result.success).toBe(false);
    });

    it('should reject weight above 100', () => {
      const result = CreateCriterionSchema.safeParse({
        templateCheckpointId: 1,
        title: 'Code Quality',
        weight: 101,
        order: 0,
      });
      expect(result.success).toBe(false);
    });

    it('should reject weight below 0', () => {
      const result = CreateCriterionSchema.safeParse({
        templateCheckpointId: 1,
        title: 'Code Quality',
        weight: -1,
        order: 0,
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing templateCheckpointId', () => {
      const result = CreateCriterionSchema.safeParse({
        title: 'Code Quality',
        weight: 50,
        order: 0,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('UpdateCriterionSchema', () => {
    it('should accept valid criterion with id', () => {
      const result = UpdateCriterionSchema.safeParse({
        id: 5,
        title: 'Code Quality',
        weight: 50,
        order: 0,
      });
      expect(result.success).toBe(true);
    });

    it('should reject without id', () => {
      const result = UpdateCriterionSchema.safeParse({
        title: 'Code Quality',
        weight: 50,
        order: 0,
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty title', () => {
      const result = UpdateCriterionSchema.safeParse({
        id: 5,
        title: '',
        weight: 50,
        order: 0,
      });
      expect(result.success).toBe(false);
    });

    it('should reject weight above 100', () => {
      const result = UpdateCriterionSchema.safeParse({
        id: 5,
        title: 'Code Quality',
        weight: 101,
        order: 0,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('CreateLevelSchema', () => {
    it('should accept valid level', () => {
      const result = CreateLevelSchema.safeParse({
        templateCheckpointId: 1,
        label: 'Excellent',
        description: 'Outstanding work',
        score: 90,
        order: 0,
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty label', () => {
      const result = CreateLevelSchema.safeParse({
        templateCheckpointId: 1,
        label: '',
        score: 90,
        order: 0,
      });
      expect(result.success).toBe(false);
    });

    it('should reject score above 100', () => {
      const result = CreateLevelSchema.safeParse({
        templateCheckpointId: 1,
        label: 'Excellent',
        score: 101,
        order: 0,
      });
      expect(result.success).toBe(false);
    });

    it('should reject score below 0', () => {
      const result = CreateLevelSchema.safeParse({
        templateCheckpointId: 1,
        label: 'Poor',
        score: -1,
        order: 0,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('UpdateLevelSchema', () => {
    it('should accept valid level with id', () => {
      const result = UpdateLevelSchema.safeParse({
        id: 3,
        label: 'Excellent',
        score: 90,
        order: 0,
      });
      expect(result.success).toBe(true);
    });

    it('should reject without id', () => {
      const result = UpdateLevelSchema.safeParse({
        label: 'Excellent',
        score: 90,
        order: 0,
      });
      expect(result.success).toBe(false);
    });

    it('should reject score above 100', () => {
      const result = UpdateLevelSchema.safeParse({
        id: 3,
        label: 'Excellent',
        score: 101,
        order: 0,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('SaveRubricSchema', () => {
    it('should accept valid numeric rubric (weights sum to 100)', () => {
      const result = SaveRubricSchema.safeParse({
        templateCheckpointId: 1,
        gradingType: 'numeric',
        criteria: [
          { title: 'Code Quality', weight: 50, order: 0 },
          { title: 'Documentation', weight: 50, order: 1 },
        ],
        levels: [],
      });
      expect(result.success).toBe(true);
    });

    it('should accept valid qualitative rubric (weights sum to 100, has levels)', () => {
      const result = SaveRubricSchema.safeParse({
        templateCheckpointId: 1,
        gradingType: 'qualitative',
        criteria: [{ title: 'Code Quality', weight: 100, order: 0 }],
        levels: [
          { label: 'Excellent', score: 90, order: 0 },
          { label: 'Needs Work', score: 50, order: 1 },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('should accept null grading type with no criteria or levels', () => {
      const result = SaveRubricSchema.safeParse({
        templateCheckpointId: 1,
        gradingType: null,
        criteria: [],
        levels: [],
      });
      expect(result.success).toBe(true);
    });

    it('should reject weights not summing to 100', () => {
      const result = SaveRubricSchema.safeParse({
        templateCheckpointId: 1,
        gradingType: 'numeric',
        criteria: [
          { title: 'Code Quality', weight: 40, order: 0 },
          { title: 'Documentation', weight: 50, order: 1 },
        ],
        levels: [],
      });
      expect(result.success).toBe(false);
    });

    it('should reject levels when gradingType is numeric', () => {
      const result = SaveRubricSchema.safeParse({
        templateCheckpointId: 1,
        gradingType: 'numeric',
        criteria: [{ title: 'Code Quality', weight: 100, order: 0 }],
        levels: [{ label: 'Excellent', score: 90, order: 0 }],
      });
      expect(result.success).toBe(false);
    });

    it('should reject qualitative without levels', () => {
      const result = SaveRubricSchema.safeParse({
        templateCheckpointId: 1,
        gradingType: 'qualitative',
        criteria: [{ title: 'Code Quality', weight: 100, order: 0 }],
        levels: [],
      });
      expect(result.success).toBe(false);
    });

    it('should reject criteria when gradingType is null', () => {
      const result = SaveRubricSchema.safeParse({
        templateCheckpointId: 1,
        gradingType: null,
        criteria: [{ title: 'Code Quality', weight: 100, order: 0 }],
        levels: [],
      });
      expect(result.success).toBe(false);
    });

    it('should reject grading type set but no criteria', () => {
      const result = SaveRubricSchema.safeParse({
        templateCheckpointId: 1,
        gradingType: 'numeric',
        criteria: [],
        levels: [],
      });
      expect(result.success).toBe(false);
    });

    it('should reject criterion with empty title', () => {
      const result = SaveRubricSchema.safeParse({
        templateCheckpointId: 1,
        gradingType: 'numeric',
        criteria: [{ title: '', weight: 100, order: 0 }],
        levels: [],
      });
      expect(result.success).toBe(false);
    });

    it('should reject score above 100 in levels', () => {
      const result = SaveRubricSchema.safeParse({
        templateCheckpointId: 1,
        gradingType: 'qualitative',
        criteria: [{ title: 'Code Quality', weight: 100, order: 0 }],
        levels: [{ label: 'Excellent', score: 101, order: 0 }],
      });
      expect(result.success).toBe(false);
    });

    it('should accept criteria with optional id for existing criteria', () => {
      const result = SaveRubricSchema.safeParse({
        templateCheckpointId: 1,
        gradingType: 'numeric',
        criteria: [
          { id: 5, title: 'Code Quality', weight: 50, order: 0 },
          { title: 'Documentation', weight: 50, order: 1 },
        ],
        levels: [],
      });
      expect(result.success).toBe(true);
    });
  });

  describe('DeleteCriterionSchema', () => {
    it('should accept valid id', () => {
      const result = DeleteCriterionSchema.safeParse({ id: 1 });
      expect(result.success).toBe(true);
    });

    it('should reject missing id', () => {
      const result = DeleteCriterionSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should reject non-positive id', () => {
      const result = DeleteCriterionSchema.safeParse({ id: 0 });
      expect(result.success).toBe(false);
    });
  });

  describe('DeleteLevelSchema', () => {
    it('should accept valid id', () => {
      const result = DeleteLevelSchema.safeParse({ id: 1 });
      expect(result.success).toBe(true);
    });

    it('should reject missing id', () => {
      const result = DeleteLevelSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('GetRubricSchema', () => {
    it('should accept valid templateCheckpointId', () => {
      const result = GetRubricSchema.safeParse({ templateCheckpointId: 1 });
      expect(result.success).toBe(true);
    });

    it('should reject missing templateCheckpointId', () => {
      const result = GetRubricSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should reject non-positive templateCheckpointId', () => {
      const result = GetRubricSchema.safeParse({ templateCheckpointId: 0 });
      expect(result.success).toBe(false);
    });
  });

  describe('Server Function Stubs', () => {
    it('should export saveRubric function', async () => {
      const { saveRubric } = await import('@/server/rubrics');
      expect(saveRubric).toBeDefined();
      expect(typeof saveRubric).toBe('function');
    });

    it('should export getRubric function', async () => {
      const { getRubric } = await import('@/server/rubrics');
      expect(getRubric).toBeDefined();
      expect(typeof getRubric).toBe('function');
    });

    it('should export softDeleteCriterion function', async () => {
      const { softDeleteCriterion } = await import('@/server/rubrics');
      expect(softDeleteCriterion).toBeDefined();
      expect(typeof softDeleteCriterion).toBe('function');
    });

    it('should export softDeleteLevel function', async () => {
      const { softDeleteLevel } = await import('@/server/rubrics');
      expect(softDeleteLevel).toBeDefined();
      expect(typeof softDeleteLevel).toBe('function');
    });
  });
});
