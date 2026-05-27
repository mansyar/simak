/** @vitest-environment node */
import { describe, it, expect, vi } from 'vitest';

// Mock createServerFn before importing
vi.mock('@tanstack/react-start', () => ({
  createServerFn: vi.fn().mockReturnValue({
    handler: vi.fn().mockImplementation((fn) => fn),
  }),
}));

import {
  CreateAssignmentSchema,
  ListInstructorAssignmentsSchema,
  AssignmentIdParamSchema,
  ListStudentAssignmentsSchema,
  StudentAssignmentIdParamSchema,
  UnlockCheckpointSchema,
  ExtendDeadlineSchema,
} from '@/server/assignments';

describe('Assignment Schemas', () => {
  describe('CreateAssignmentSchema', () => {
    it('should accept valid input', () => {
      const result = CreateAssignmentSchema.safeParse({
        templateId: 1,
        title: 'Test Assignment',
        description: 'A test assignment',
        finalDeadline: new Date(Date.now() + 86400000).toISOString(), // tomorrow
        studentIds: ['student-1', 'student-2'],
      });
      expect(result.success).toBe(true);
    });

    it('should reject missing templateId', () => {
      const result = CreateAssignmentSchema.safeParse({
        title: 'Test Assignment',
        finalDeadline: new Date(Date.now() + 86400000).toISOString(),
        studentIds: ['student-1'],
      });
      expect(result.success).toBe(false);
    });

    it('should reject short title', () => {
      const result = CreateAssignmentSchema.safeParse({
        templateId: 1,
        title: 'AB',
        finalDeadline: new Date(Date.now() + 86400000).toISOString(),
        studentIds: ['student-1'],
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty studentIds', () => {
      const result = CreateAssignmentSchema.safeParse({
        templateId: 1,
        title: 'Test Assignment',
        finalDeadline: new Date(Date.now() + 86400000).toISOString(),
        studentIds: [],
      });
      expect(result.success).toBe(false);
    });

    it('should use default empty description', () => {
      const result = CreateAssignmentSchema.safeParse({
        templateId: 1,
        title: 'Test Assignment',
        finalDeadline: new Date(Date.now() + 86400000).toISOString(),
        studentIds: ['student-1'],
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.description).toBe('');
      }
    });
  });

  describe('ListInstructorAssignmentsSchema', () => {
    it('should accept valid input with defaults', () => {
      const result = ListInstructorAssignmentsSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(20);
        expect(result.data.search).toBe('');
      }
    });

    it('should accept custom pagination', () => {
      const result = ListInstructorAssignmentsSchema.safeParse({
        page: 2,
        limit: 50,
        search: 'test',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(2);
        expect(result.data.limit).toBe(50);
        expect(result.data.search).toBe('test');
      }
    });

    it('should reject page less than 1', () => {
      const result = ListInstructorAssignmentsSchema.safeParse({ page: 0 });
      expect(result.success).toBe(false);
    });

    it('should reject limit greater than 100', () => {
      const result = ListInstructorAssignmentsSchema.safeParse({ limit: 101 });
      expect(result.success).toBe(false);
    });
  });

  describe('AssignmentIdParamSchema', () => {
    it('should accept valid ID', () => {
      const result = AssignmentIdParamSchema.safeParse({ id: 1 });
      expect(result.success).toBe(true);
    });

    it('should reject negative ID', () => {
      const result = AssignmentIdParamSchema.safeParse({ id: -1 });
      expect(result.success).toBe(false);
    });

    it('should reject zero ID', () => {
      const result = AssignmentIdParamSchema.safeParse({ id: 0 });
      expect(result.success).toBe(false);
    });
  });

  describe('ListStudentAssignmentsSchema', () => {
    it('should accept valid input with defaults', () => {
      const result = ListStudentAssignmentsSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(20);
        expect(result.data.search).toBe('');
      }
    });
  });

  describe('StudentAssignmentIdParamSchema', () => {
    it('should accept valid ID', () => {
      const result = StudentAssignmentIdParamSchema.safeParse({ id: 1 });
      expect(result.success).toBe(true);
    });

    it('should reject negative ID', () => {
      const result = StudentAssignmentIdParamSchema.safeParse({ id: -1 });
      expect(result.success).toBe(false);
    });
  });

  describe('UnlockCheckpointSchema', () => {
    it('should accept valid checkpointId', () => {
      const result = UnlockCheckpointSchema.safeParse({ checkpointId: 1 });
      expect(result.success).toBe(true);
    });

    it('should reject missing checkpointId', () => {
      const result = UnlockCheckpointSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should reject negative checkpointId', () => {
      const result = UnlockCheckpointSchema.safeParse({ checkpointId: -1 });
      expect(result.success).toBe(false);
    });
  });

  describe('ExtendDeadlineSchema', () => {
    it('should accept valid input', () => {
      const result = ExtendDeadlineSchema.safeParse({
        checkpointId: 1,
        newDueDate: new Date(Date.now() + 86400000).toISOString(),
      });
      expect(result.success).toBe(true);
    });

    it('should reject past deadline', () => {
      const result = ExtendDeadlineSchema.safeParse({
        checkpointId: 1,
        newDueDate: new Date(Date.now() - 86400000).toISOString(),
      });
      expect(result.success).toBe(false);
    });
  });
});
