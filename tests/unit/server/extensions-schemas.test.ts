/** @vitest-environment node */
import { describe, it, expect, vi } from 'vitest';
import {
  RequestExtensionSchema,
  ListExtensionRequestsSchema,
  ApproveExtensionSchema,
  RejectExtensionSchema,
  BulkExtendSchema,
} from '@/server/extensions';

vi.mock('@tanstack/react-start', () => ({
  createServerFn: vi.fn().mockReturnValue({
    inputValidator: vi.fn().mockReturnThis(),
    handler: vi.fn().mockImplementation((fn) => fn),
  }),
}));

describe('Extension Schemas', () => {
  describe('RequestExtensionSchema', () => {
    it('should accept valid input with all fields', () => {
      const result = RequestExtensionSchema.safeParse({
        assignmentId: 1,
        category: 'personal',
        reason: 'I need more time to complete this assignment due to personal matters',
        extensionDays: 5,
      });
      expect(result.success).toBe(true);
    });

    it('should accept input with checkpointId', () => {
      const result = RequestExtensionSchema.safeParse({
        assignmentId: 1,
        checkpointId: 10,
        category: 'health',
        reason: 'Medical appointment conflicts with current deadline',
        extensionDays: 3,
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid category', () => {
      const result = RequestExtensionSchema.safeParse({
        assignmentId: 1,
        category: 'invalid',
        reason: 'Some valid reason here with enough characters',
        extensionDays: 5,
      });
      expect(result.success).toBe(false);
    });

    it('should reject reason shorter than 10 characters', () => {
      const result = RequestExtensionSchema.safeParse({
        assignmentId: 1,
        category: 'other',
        reason: 'Short',
        extensionDays: 5,
      });
      expect(result.success).toBe(false);
    });

    it('should reject extensionDays less than 1', () => {
      const result = RequestExtensionSchema.safeParse({
        assignmentId: 1,
        category: 'research',
        reason: 'Research extension needed for data collection phase',
        extensionDays: 0,
      });
      expect(result.success).toBe(false);
    });

    it('should reject extensionDays greater than 30', () => {
      const result = RequestExtensionSchema.safeParse({
        assignmentId: 1,
        category: 'personal',
        reason: 'Extended leave of absence due to family emergency',
        extensionDays: 31,
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing assignmentId', () => {
      const result = RequestExtensionSchema.safeParse({
        category: 'personal',
        reason: 'Personal reasons for needing more time on this project',
        extensionDays: 5,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('RejectExtensionSchema', () => {
    it('should accept valid input with long enough reason', () => {
      const result = RejectExtensionSchema.safeParse({
        requestId: 1,
        resolutionReason:
          'This is a very long and detailed reason for rejecting the extension request',
      });
      expect(result.success).toBe(true);
    });

    it('should reject resolutionReason shorter than 20 characters', () => {
      const result = RejectExtensionSchema.safeParse({
        requestId: 1,
        resolutionReason: 'Too short',
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing resolutionReason', () => {
      const result = RejectExtensionSchema.safeParse({
        requestId: 1,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('ApproveExtensionSchema', () => {
    it('should accept valid input', () => {
      const result = ApproveExtensionSchema.safeParse({
        requestId: 1,
      });
      expect(result.success).toBe(true);
    });

    it('should accept with optional resolutionReason', () => {
      const result = ApproveExtensionSchema.safeParse({
        requestId: 1,
        resolutionReason: 'Approved due to valid circumstances',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('BulkExtendSchema', () => {
    it('should accept valid input', () => {
      const result = BulkExtendSchema.safeParse({
        assignmentId: 1,
        studentId: 'student-1',
        extraDays: 7,
        reason: 'General extension for whole class',
      });
      expect(result.success).toBe(true);
    });

    it('should reject non-positive extraDays', () => {
      const result = BulkExtendSchema.safeParse({
        assignmentId: 1,
        studentId: 'student-1',
        extraDays: 0,
        reason: 'Some reason',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('ListExtensionRequestsSchema', () => {
    it('should accept valid input with defaults', () => {
      const result = ListExtensionRequestsSchema.safeParse({
        assignmentId: 1,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(20);
      }
    });

    it('should accept input with status filter', () => {
      const result = ListExtensionRequestsSchema.safeParse({
        assignmentId: 1,
        status: 'pending',
        page: 2,
        limit: 10,
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid status', () => {
      const result = ListExtensionRequestsSchema.safeParse({
        assignmentId: 1,
        status: 'invalid',
      });
      expect(result.success).toBe(false);
    });
  });
});
