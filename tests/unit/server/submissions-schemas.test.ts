/** @vitest-environment node */
import { describe, it, expect, vi } from 'vitest';

// Mock createServerFn before importing
vi.mock('@tanstack/react-start', () => ({
  createServerFn: vi.fn().mockReturnValue({
    handler: vi.fn().mockImplementation((fn) => fn),
  }),
}));

import {
  SubmitCheckpointSchema,
  ListSubmissionsSchema,
  GetSubmissionDetailSchema,
} from '@/server/submissions';

describe('Submission Schemas', () => {
  describe('SubmitCheckpointSchema', () => {
    it('should accept valid submission', () => {
      const result = SubmitCheckpointSchema.safeParse({
        checkpointId: 1,
        fileKey: 'submissions/uuid-123.pdf',
        fileName: 'chapter1.pdf',
        fileSize: 1024,
      });
      expect(result.success).toBe(true);
    });

    it('should reject missing checkpointId', () => {
      const result = SubmitCheckpointSchema.safeParse({
        fileKey: 'submissions/uuid-123.pdf',
        fileName: 'chapter1.pdf',
        fileSize: 1024,
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty fileKey', () => {
      const result = SubmitCheckpointSchema.safeParse({
        checkpointId: 1,
        fileKey: '',
        fileName: 'chapter1.pdf',
        fileSize: 1024,
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty fileName', () => {
      const result = SubmitCheckpointSchema.safeParse({
        checkpointId: 1,
        fileKey: 'submissions/uuid-123.pdf',
        fileName: '',
        fileSize: 1024,
      });
      expect(result.success).toBe(false);
    });

    it('should reject negative fileSize', () => {
      const result = SubmitCheckpointSchema.safeParse({
        checkpointId: 1,
        fileKey: 'submissions/uuid-123.pdf',
        fileName: 'chapter1.pdf',
        fileSize: -1,
      });
      expect(result.success).toBe(false);
    });

    it('should accept zero fileSize', () => {
      const result = SubmitCheckpointSchema.safeParse({
        checkpointId: 1,
        fileKey: 'submissions/uuid-123.pdf',
        fileName: 'chapter1.pdf',
        fileSize: 0,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('ListSubmissionsSchema', () => {
    it('should accept valid checkpointId', () => {
      const result = ListSubmissionsSchema.safeParse({
        checkpointId: 1,
      });
      expect(result.success).toBe(true);
    });

    it('should reject missing checkpointId', () => {
      const result = ListSubmissionsSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should reject negative checkpointId', () => {
      const result = ListSubmissionsSchema.safeParse({
        checkpointId: -1,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('GetSubmissionDetailSchema', () => {
    it('should accept valid submissionId', () => {
      const result = GetSubmissionDetailSchema.safeParse({
        submissionId: 1,
      });
      expect(result.success).toBe(true);
    });

    it('should reject missing submissionId', () => {
      const result = GetSubmissionDetailSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should reject negative submissionId', () => {
      const result = GetSubmissionDetailSchema.safeParse({
        submissionId: -1,
      });
      expect(result.success).toBe(false);
    });
  });
});
