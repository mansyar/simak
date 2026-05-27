/** @vitest-environment node */
import { describe, it, expect, vi } from 'vitest';

// Mock createServerFn before importing
vi.mock('@tanstack/react-start', () => ({
  createServerFn: vi.fn().mockReturnValue({
    handler: vi.fn().mockImplementation((fn) => fn),
  }),
}));

import {
  LogConsultationSchema,
  ListConsultationsSchema,
  ListPendingConsultationsSchema,
  VerifyConsultationSchema,
  RejectConsultationSchema,
  GetConsultationDetailSchema,
  ListVerifiedCountsSchema,
} from '@/server/consultations';

describe('Consultation Schemas', () => {
  describe('LogConsultationSchema', () => {
    it('should accept valid internal consultation', () => {
      const result = LogConsultationSchema.safeParse({
        checkpointId: 1,
        sessionType: 'internal',
        notes: 'Discussed chapter 1 progress',
      });
      expect(result.success).toBe(true);
    });

    it('should accept valid external consultation', () => {
      const result = LogConsultationSchema.safeParse({
        checkpointId: 1,
        sessionType: 'external',
        externalConsultantName: 'Dr. Smith',
        notes: 'External review meeting',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid session type', () => {
      const result = LogConsultationSchema.safeParse({
        checkpointId: 1,
        sessionType: 'invalid',
        notes: 'Some notes',
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty notes', () => {
      const result = LogConsultationSchema.safeParse({
        checkpointId: 1,
        sessionType: 'internal',
        notes: '',
      });
      expect(result.success).toBe(false);
    });

    it('should reject negative checkpointId', () => {
      const result = LogConsultationSchema.safeParse({
        checkpointId: -1,
        sessionType: 'internal',
        notes: 'Some notes',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('ListConsultationsSchema', () => {
    it('should accept valid input', () => {
      const result = ListConsultationsSchema.safeParse({
        assignmentId: 1,
      });
      expect(result.success).toBe(true);
    });

    it('should accept optional checkpointId', () => {
      const result = ListConsultationsSchema.safeParse({
        assignmentId: 1,
        checkpointId: 5,
      });
      expect(result.success).toBe(true);
    });

    it('should reject missing assignmentId', () => {
      const result = ListConsultationsSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('ListPendingConsultationsSchema', () => {
    it('should accept valid input', () => {
      const result = ListPendingConsultationsSchema.safeParse({
        assignmentId: 1,
      });
      expect(result.success).toBe(true);
    });

    it('should reject missing assignmentId', () => {
      const result = ListPendingConsultationsSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('VerifyConsultationSchema', () => {
    it('should accept valid consultationId', () => {
      const result = VerifyConsultationSchema.safeParse({
        consultationId: 1,
      });
      expect(result.success).toBe(true);
    });

    it('should reject missing consultationId', () => {
      const result = VerifyConsultationSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should reject negative consultationId', () => {
      const result = VerifyConsultationSchema.safeParse({
        consultationId: -1,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('RejectConsultationSchema', () => {
    it('should accept valid input', () => {
      const result = RejectConsultationSchema.safeParse({
        consultationId: 1,
        reason: 'Incomplete documentation',
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty reason', () => {
      const result = RejectConsultationSchema.safeParse({
        consultationId: 1,
        reason: '',
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing reason', () => {
      const result = RejectConsultationSchema.safeParse({
        consultationId: 1,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('GetConsultationDetailSchema', () => {
    it('should accept valid consultationId', () => {
      const result = GetConsultationDetailSchema.safeParse({
        consultationId: 1,
      });
      expect(result.success).toBe(true);
    });

    it('should reject missing consultationId', () => {
      const result = GetConsultationDetailSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('ListVerifiedCountsSchema', () => {
    it('should accept valid assignmentId', () => {
      const result = ListVerifiedCountsSchema.safeParse({
        assignmentId: 1,
      });
      expect(result.success).toBe(true);
    });

    it('should reject missing assignmentId', () => {
      const result = ListVerifiedCountsSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });
});
