/** @vitest-environment node */
import { describe, it, expect, vi } from 'vitest';

// Mock createServerFn before importing
vi.mock('@tanstack/react-start', () => ({
  createServerFn: vi.fn().mockReturnValue({
    inputValidator: vi.fn().mockReturnThis(),
    handler: vi.fn().mockImplementation((fn) => fn),
  }),
}));

import {
  ListPendingReviewsSchema,
  GetReviewDetailSchema,
  OpenForReviewSchema,
  SubmitReviewSchema,
  GetLatestReviewSchema,
} from '@/server/reviews';

describe('Review Schemas', () => {
  describe('ListPendingReviewsSchema', () => {
    it('should accept empty input with defaults', () => {
      const result = ListPendingReviewsSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(20);
        expect(result.data.assignmentId).toBeUndefined();
      }
    });

    it('should accept custom pagination', () => {
      const result = ListPendingReviewsSchema.safeParse({
        page: 2,
        limit: 50,
        assignmentId: 1,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(2);
        expect(result.data.limit).toBe(50);
        expect(result.data.assignmentId).toBe(1);
      }
    });

    it('should reject page less than 1', () => {
      const result = ListPendingReviewsSchema.safeParse({ page: 0 });
      expect(result.success).toBe(false);
    });

    it('should reject limit greater than 100', () => {
      const result = ListPendingReviewsSchema.safeParse({ limit: 101 });
      expect(result.success).toBe(false);
    });
  });

  describe('GetReviewDetailSchema', () => {
    it('should accept valid submissionId', () => {
      const result = GetReviewDetailSchema.safeParse({ submissionId: 1 });
      expect(result.success).toBe(true);
    });

    it('should reject missing submissionId', () => {
      const result = GetReviewDetailSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should reject negative submissionId', () => {
      const result = GetReviewDetailSchema.safeParse({ submissionId: -1 });
      expect(result.success).toBe(false);
    });
  });

  describe('OpenForReviewSchema', () => {
    it('should accept valid submissionId', () => {
      const result = OpenForReviewSchema.safeParse({ submissionId: 1 });
      expect(result.success).toBe(true);
    });

    it('should reject missing submissionId', () => {
      const result = OpenForReviewSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('SubmitReviewSchema', () => {
    it('should accept valid pass decision', () => {
      const result = SubmitReviewSchema.safeParse({
        submissionId: 1,
        decision: 'pass',
        comment: 'Good work!',
      });
      expect(result.success).toBe(true);
    });

    it('should accept valid revise decision', () => {
      const result = SubmitReviewSchema.safeParse({
        submissionId: 1,
        decision: 'revise',
        comment: 'Needs improvements',
        revisionDeadline: '2026-06-01',
      });
      expect(result.success).toBe(true);
    });

    it('should use default empty comment', () => {
      const result = SubmitReviewSchema.safeParse({
        submissionId: 1,
        decision: 'pass',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.comment).toBe('');
      }
    });

    it('should reject invalid decision', () => {
      const result = SubmitReviewSchema.safeParse({
        submissionId: 1,
        decision: 'invalid',
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing submissionId', () => {
      const result = SubmitReviewSchema.safeParse({
        decision: 'pass',
      });
      expect(result.success).toBe(false);
    });

    it('should accept optional feedbackFileKey', () => {
      const result = SubmitReviewSchema.safeParse({
        submissionId: 1,
        decision: 'pass',
        feedbackFileKey: 'feedback/uuid.pdf',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('GetLatestReviewSchema', () => {
    it('should accept valid checkpointId', () => {
      const result = GetLatestReviewSchema.safeParse({ checkpointId: 1 });
      expect(result.success).toBe(true);
    });

    it('should reject missing checkpointId', () => {
      const result = GetLatestReviewSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should reject negative checkpointId', () => {
      const result = GetLatestReviewSchema.safeParse({ checkpointId: -1 });
      expect(result.success).toBe(false);
    });
  });
});
