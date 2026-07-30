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

  describe('Server Function Stubs', () => {
    it('should export logConsultation function', async () => {
      const { logConsultation } = await import('@/server/consultations');
      expect(logConsultation).toBeDefined();
      expect(typeof logConsultation).toBe('function');
    });

    it('should export listConsultations function', async () => {
      const { listConsultations } = await import('@/server/consultations');
      expect(listConsultations).toBeDefined();
      expect(typeof listConsultations).toBe('function');
    });

    it('should export listPendingConsultations function', async () => {
      const { listPendingConsultations } = await import('@/server/consultations');
      expect(listPendingConsultations).toBeDefined();
      expect(typeof listPendingConsultations).toBe('function');
    });

    it('should export verifyConsultation function', async () => {
      const { verifyConsultation } = await import('@/server/consultations');
      expect(verifyConsultation).toBeDefined();
      expect(typeof verifyConsultation).toBe('function');
    });

    it('should export rejectConsultation function', async () => {
      const { rejectConsultation } = await import('@/server/consultations');
      expect(rejectConsultation).toBeDefined();
      expect(typeof rejectConsultation).toBe('function');
    });

    it('should export getConsultationDetail function', async () => {
      const { getConsultationDetail } = await import('@/server/consultations');
      expect(getConsultationDetail).toBeDefined();
      expect(typeof getConsultationDetail).toBe('function');
    });

    it('should export listVerifiedCounts function', async () => {
      const { listVerifiedCounts } = await import('@/server/consultations');
      expect(listVerifiedCounts).toBeDefined();
      expect(typeof listVerifiedCounts).toBe('function');
    });
  });
});
