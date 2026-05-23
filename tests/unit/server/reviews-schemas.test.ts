/** @vitest-environment node */
import { describe, it, expect, vi } from 'vitest';
import {
  ListPendingReviewsSchema,
  GetReviewDetailSchema,
  OpenForReviewSchema,
  SubmitReviewSchema,
  GetLatestReviewSchema,
} from '@/server/reviews';

vi.mock('@tanstack/react-start', () => ({
  createServerFn: vi.fn().mockReturnValue({
    handler: vi.fn().mockImplementation((fn) => fn),
  }),
}));

describe('Review server functions - Schemas', () => {
  describe('ListPendingReviewsSchema', () => {
    it('should accept valid input with defaults', () => {
      const result = ListPendingReviewsSchema.safeParse({});
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({ page: 1, limit: 20 });
    });

    it('should accept optional assignmentId', () => {
      const result = ListPendingReviewsSchema.safeParse({
        page: 1,
        limit: 10,
        assignmentId: 5,
      });
      expect(result.success).toBe(true);
      expect(result.data?.assignmentId).toBe(5);
    });

    it('should reject negative page', () => {
      const result = ListPendingReviewsSchema.safeParse({ page: 0 });
      expect(result.success).toBe(false);
    });

    it('should reject limit over 100', () => {
      const result = ListPendingReviewsSchema.safeParse({ limit: 101 });
      expect(result.success).toBe(false);
    });
  });

  describe('GetReviewDetailSchema', () => {
    it('should accept valid submissionId', () => {
      const result = GetReviewDetailSchema.safeParse({ submissionId: 1 });
      expect(result.success).toBe(true);
    });

    it('should reject non-numeric submissionId', () => {
      const result = GetReviewDetailSchema.safeParse({ submissionId: 'abc' });
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
    it('should accept pass decision without comment', () => {
      const result = SubmitReviewSchema.safeParse({
        submissionId: 1,
        decision: 'pass',
      });
      expect(result.success).toBe(true);
    });

    it('should accept pass decision with comment', () => {
      const result = SubmitReviewSchema.safeParse({
        submissionId: 1,
        decision: 'pass',
        comment: 'Great work!',
      });
      expect(result.success).toBe(true);
    });

    it('should accept revise decision with revisionDeadline', () => {
      const result = SubmitReviewSchema.safeParse({
        submissionId: 1,
        decision: 'revise',
        revisionDeadline: '2026-06-01T00:00:00Z',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid decision', () => {
      const result = SubmitReviewSchema.safeParse({
        submissionId: 1,
        decision: 'invalid',
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing submissionId', () => {
      const result = SubmitReviewSchema.safeParse({ decision: 'pass' });
      expect(result.success).toBe(false);
    });
  });

  describe('GetLatestReviewSchema', () => {
    it('should accept valid checkpointId', () => {
      const result = GetLatestReviewSchema.safeParse({ checkpointId: 1 });
      expect(result.success).toBe(true);
    });

    it('should reject non-numeric checkpointId', () => {
      const result = GetLatestReviewSchema.safeParse({ checkpointId: 'abc' });
      expect(result.success).toBe(false);
    });
  });
});
