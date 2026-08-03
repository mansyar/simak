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

    it('should accept optional scores array', () => {
      const result = SubmitReviewSchema.safeParse({
        submissionId: 1,
        decision: 'pass',
        scores: [{ criterionId: 1, score: 85 }],
      });
      expect(result.success).toBe(true);
    });

    it('should accept scores with all fields', () => {
      const result = SubmitReviewSchema.safeParse({
        submissionId: 1,
        decision: 'pass',
        scores: [{ criterionId: 1, score: 85, rubricLevelId: 2, comment: 'Good' }],
      });
      expect(result.success).toBe(true);
    });

    it('should accept scores with optional rubricLevelId and comment omitted', () => {
      const result = SubmitReviewSchema.safeParse({
        submissionId: 1,
        decision: 'pass',
        scores: [
          { criterionId: 1, score: 90 },
          { criterionId: 2, score: 80, rubricLevelId: 1 },
          { criterionId: 3, score: 70, comment: 'Needs work' },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('should accept submission without scores (backward compatible)', () => {
      const result = SubmitReviewSchema.safeParse({
        submissionId: 1,
        decision: 'pass',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.scores).toBeUndefined();
      }
    });

    it('should reject score with missing criterionId', () => {
      const result = SubmitReviewSchema.safeParse({
        submissionId: 1,
        decision: 'pass',
        scores: [{ score: 85 }],
      });
      expect(result.success).toBe(false);
    });

    it('should reject score below 0', () => {
      const result = SubmitReviewSchema.safeParse({
        submissionId: 1,
        decision: 'pass',
        scores: [{ criterionId: 1, score: -1 }],
      });
      expect(result.success).toBe(false);
    });

    it('should reject score above 100', () => {
      const result = SubmitReviewSchema.safeParse({
        submissionId: 1,
        decision: 'pass',
        scores: [{ criterionId: 1, score: 101 }],
      });
      expect(result.success).toBe(false);
    });

    it('should reject scores that is not an array', () => {
      const result = SubmitReviewSchema.safeParse({
        submissionId: 1,
        decision: 'pass',
        scores: 'not an array',
      });
      expect(result.success).toBe(false);
    });

    it('should accept a revise plan with no action items for backward compatibility', () => {
      const result = SubmitReviewSchema.safeParse({
        submissionId: 1,
        decision: 'revise',
        comment: 'Please revise the introduction',
        revisionDeadline: '2026-06-01',
      });
      expect(result.success).toBe(true);
    });

    it('should accept exactly ten ordered action items with a 500-character item', () => {
      const actionItems = Array.from({ length: 10 }, (_, index) => ({
        itemText: index === 0 ? 'x'.repeat(500) : `Revision item ${index + 1}`,
        criterionId: index === 0 ? 7 : undefined,
      }));
      const result = SubmitReviewSchema.safeParse({
        submissionId: 1,
        decision: 'revise',
        revisionDeadline: '2026-06-01',
        actionItems,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.actionItems).toHaveLength(10);
        expect(result.data.actionItems?.map((item) => item.itemText)).toEqual(
          actionItems.map((item) => item.itemText),
        );
      }
    });

    it('should reject more than ten action items', () => {
      const result = SubmitReviewSchema.safeParse({
        submissionId: 1,
        decision: 'revise',
        revisionDeadline: '2026-06-01',
        actionItems: Array.from({ length: 11 }, () => ({ itemText: 'Revise this section' })),
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty, over-limit, and rich-text action items', () => {
      const cases = [
        { itemText: '   ' },
        { itemText: 'x'.repeat(501) },
        { itemText: '<strong>Use plain text</strong>' },
      ];

      for (const item of cases) {
        const result = SubmitReviewSchema.safeParse({
          submissionId: 1,
          decision: 'revise',
          revisionDeadline: '2026-06-01',
          actionItems: [item],
        });
        expect(result.success).toBe(false);
      }
    });

    it('should reject action items on a pass decision', () => {
      const result = SubmitReviewSchema.safeParse({
        submissionId: 1,
        decision: 'pass',
        actionItems: [{ itemText: 'This must not be attached to a pass' }],
      });
      expect(result.success).toBe(false);
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
