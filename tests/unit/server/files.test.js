/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import {
  GetPresignedUploadUrlSchema,
  GetPresignedDownloadUrlSchema,
  GetPresignedReviewFeedbackUploadUrlSchema,
} from '@/server/files';
describe('Files server functions - Schemas', () => {
  describe('GetPresignedUploadUrlSchema', () => {
    it('should accept valid input', () => {
      const result = GetPresignedUploadUrlSchema.safeParse({
        checkpointId: 1,
        contentType: 'application/pdf',
        extension: 'pdf',
      });
      expect(result.success).toBe(true);
    });
    it('should reject missing checkpointId', () => {
      const result = GetPresignedUploadUrlSchema.safeParse({
        contentType: 'application/pdf',
        extension: 'pdf',
      });
      expect(result.success).toBe(false);
    });
    it('should reject negative checkpointId', () => {
      const result = GetPresignedUploadUrlSchema.safeParse({
        checkpointId: -1,
        contentType: 'application/pdf',
        extension: 'pdf',
      });
      expect(result.success).toBe(false);
    });
    it('should reject zero checkpointId', () => {
      const result = GetPresignedUploadUrlSchema.safeParse({
        checkpointId: 0,
        contentType: 'application/pdf',
        extension: 'pdf',
      });
      expect(result.success).toBe(false);
    });
    it('should reject missing contentType', () => {
      const result = GetPresignedUploadUrlSchema.safeParse({
        checkpointId: 1,
        extension: 'pdf',
      });
      expect(result.success).toBe(false);
    });
    it('should reject empty contentType', () => {
      const result = GetPresignedUploadUrlSchema.safeParse({
        checkpointId: 1,
        contentType: '',
        extension: 'pdf',
      });
      expect(result.success).toBe(false);
    });
    it('should reject missing extension', () => {
      const result = GetPresignedUploadUrlSchema.safeParse({
        checkpointId: 1,
        contentType: 'application/pdf',
      });
      expect(result.success).toBe(false);
    });
    it('should reject empty extension', () => {
      const result = GetPresignedUploadUrlSchema.safeParse({
        checkpointId: 1,
        contentType: 'application/pdf',
        extension: '',
      });
      expect(result.success).toBe(false);
    });
  });
  describe('GetPresignedDownloadUrlSchema', () => {
    it('should accept valid input', () => {
      const result = GetPresignedDownloadUrlSchema.safeParse({
        submissionId: 1,
      });
      expect(result.success).toBe(true);
    });
    it('should reject missing submissionId', () => {
      const result = GetPresignedDownloadUrlSchema.safeParse({});
      expect(result.success).toBe(false);
    });
    it('should reject negative submissionId', () => {
      const result = GetPresignedDownloadUrlSchema.safeParse({
        submissionId: -1,
      });
      expect(result.success).toBe(false);
    });
    it('should reject zero submissionId', () => {
      const result = GetPresignedDownloadUrlSchema.safeParse({
        submissionId: 0,
      });
      expect(result.success).toBe(false);
    });
  });
  describe('GetPresignedReviewFeedbackUploadUrlSchema', () => {
    it('should accept valid input', () => {
      const result = GetPresignedReviewFeedbackUploadUrlSchema.safeParse({
        extension: 'pdf',
        contentType: 'application/pdf',
      });
      expect(result.success).toBe(true);
    });
    it('should reject missing extension', () => {
      const result = GetPresignedReviewFeedbackUploadUrlSchema.safeParse({
        contentType: 'application/pdf',
      });
      expect(result.success).toBe(false);
    });
    it('should reject empty extension', () => {
      const result = GetPresignedReviewFeedbackUploadUrlSchema.safeParse({
        extension: '',
        contentType: 'application/pdf',
      });
      expect(result.success).toBe(false);
    });
    it('should reject missing contentType', () => {
      const result = GetPresignedReviewFeedbackUploadUrlSchema.safeParse({
        extension: 'pdf',
      });
      expect(result.success).toBe(false);
    });
    it('should reject empty contentType', () => {
      const result = GetPresignedReviewFeedbackUploadUrlSchema.safeParse({
        extension: 'pdf',
        contentType: '',
      });
      expect(result.success).toBe(false);
    });
  });
});
