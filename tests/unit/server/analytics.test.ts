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
  AnalyticsDateRangeSchema,
  ExportUsersCsvSchema,
  ExportAuditLogCsvSchema,
  ExportAssignmentProgressCsvSchema,
  ExportStudentProgressCsvSchema,
  ExportReviewHistoryCsvSchema,
} from '@/server/analytics';

describe('Analytics Schemas', () => {
  describe('AnalyticsDateRangeSchema', () => {
    it('should accept predefined range 7d', () => {
      const result = AnalyticsDateRangeSchema.safeParse({ range: '7d' });
      expect(result.success).toBe(true);
    });

    it('should accept predefined range 30d', () => {
      const result = AnalyticsDateRangeSchema.safeParse({ range: '30d' });
      expect(result.success).toBe(true);
    });

    it('should accept predefined range 90d', () => {
      const result = AnalyticsDateRangeSchema.safeParse({ range: '90d' });
      expect(result.success).toBe(true);
    });

    it('should accept predefined range all', () => {
      const result = AnalyticsDateRangeSchema.safeParse({ range: 'all' });
      expect(result.success).toBe(true);
    });

    it('should accept custom date range with start and end as ISO strings', () => {
      const result = AnalyticsDateRangeSchema.safeParse({
        start: '2026-01-01',
        end: '2026-07-22',
      });
      expect(result.success).toBe(true);
    });

    it('should accept custom date range with Date objects', () => {
      const result = AnalyticsDateRangeSchema.safeParse({
        start: new Date('2026-01-01'),
        end: new Date('2026-07-22'),
      });
      expect(result.success).toBe(true);
    });

    it('should accept empty object (defaults to 30d in handler)', () => {
      const result = AnalyticsDateRangeSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should reject invalid range value', () => {
      const result = AnalyticsDateRangeSchema.safeParse({ range: '1d' });
      expect(result.success).toBe(false);
    });

    it('should reject start without end', () => {
      const result = AnalyticsDateRangeSchema.safeParse({ start: '2026-01-01' });
      expect(result.success).toBe(false);
    });

    it('should reject end without start', () => {
      const result = AnalyticsDateRangeSchema.safeParse({ end: '2026-07-22' });
      expect(result.success).toBe(false);
    });

    it('should reject start after end', () => {
      const result = AnalyticsDateRangeSchema.safeParse({
        start: '2026-07-22',
        end: '2026-01-01',
      });
      expect(result.success).toBe(false);
    });

    it('should coerce string dates to Date objects on success', () => {
      const result = AnalyticsDateRangeSchema.safeParse({
        start: '2026-01-01',
        end: '2026-07-22',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.start).toBeInstanceOf(Date);
        expect(result.data.end).toBeInstanceOf(Date);
      }
    });
  });

  describe('Server Function Stubs', () => {
    it('should export getAdminAnalyticsData function', async () => {
      const { getAdminAnalyticsData } = await import('@/server/analytics');
      expect(getAdminAnalyticsData).toBeDefined();
      expect(typeof getAdminAnalyticsData).toBe('function');
    });

    it('should export getInstructorAnalyticsData function', async () => {
      const { getInstructorAnalyticsData } = await import('@/server/analytics');
      expect(getInstructorAnalyticsData).toBeDefined();
      expect(typeof getInstructorAnalyticsData).toBe('function');
    });

    it('should export exportUsersCsv function', async () => {
      const { exportUsersCsv } = await import('@/server/analytics');
      expect(exportUsersCsv).toBeDefined();
      expect(typeof exportUsersCsv).toBe('function');
    });

    it('should export exportAuditLogCsv function', async () => {
      const { exportAuditLogCsv } = await import('@/server/analytics');
      expect(exportAuditLogCsv).toBeDefined();
      expect(typeof exportAuditLogCsv).toBe('function');
    });

    it('should export exportAssignmentProgressCsv function', async () => {
      const { exportAssignmentProgressCsv } = await import('@/server/analytics');
      expect(exportAssignmentProgressCsv).toBeDefined();
      expect(typeof exportAssignmentProgressCsv).toBe('function');
    });

    it('should export exportStudentProgressCsv function', async () => {
      const { exportStudentProgressCsv } = await import('@/server/analytics');
      expect(exportStudentProgressCsv).toBeDefined();
      expect(typeof exportStudentProgressCsv).toBe('function');
    });

    it('should export exportReviewHistoryCsv function', async () => {
      const { exportReviewHistoryCsv } = await import('@/server/analytics');
      expect(exportReviewHistoryCsv).toBeDefined();
      expect(typeof exportReviewHistoryCsv).toBe('function');
    });
  });

  describe('ExportUsersCsvSchema', () => {
    it('should accept empty object', () => {
      const result = ExportUsersCsvSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  describe('ExportAuditLogCsvSchema', () => {
    it('should accept empty object (no date filter)', () => {
      const result = ExportAuditLogCsvSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should accept dateFrom only', () => {
      const result = ExportAuditLogCsvSchema.safeParse({ dateFrom: '2026-01-01' });
      expect(result.success).toBe(true);
    });

    it('should accept dateTo only', () => {
      const result = ExportAuditLogCsvSchema.safeParse({ dateTo: '2026-07-22' });
      expect(result.success).toBe(true);
    });

    it('should accept both dateFrom and dateTo', () => {
      const result = ExportAuditLogCsvSchema.safeParse({
        dateFrom: '2026-01-01',
        dateTo: '2026-07-22',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('ExportAssignmentProgressCsvSchema', () => {
    it('should accept empty object', () => {
      const result = ExportAssignmentProgressCsvSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  describe('ExportStudentProgressCsvSchema', () => {
    it('should accept valid assignmentId', () => {
      const result = ExportStudentProgressCsvSchema.safeParse({ assignmentId: 1 });
      expect(result.success).toBe(true);
    });

    it('should coerce string assignmentId to number', () => {
      const result = ExportStudentProgressCsvSchema.safeParse({ assignmentId: '5' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.assignmentId).toBe(5);
      }
    });

    it('should reject missing assignmentId', () => {
      const result = ExportStudentProgressCsvSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should reject non-positive assignmentId', () => {
      const result = ExportStudentProgressCsvSchema.safeParse({ assignmentId: 0 });
      expect(result.success).toBe(false);
    });

    it('should reject non-integer assignmentId', () => {
      const result = ExportStudentProgressCsvSchema.safeParse({ assignmentId: 1.5 });
      expect(result.success).toBe(false);
    });
  });

  describe('ExportReviewHistoryCsvSchema', () => {
    it('should accept valid assignmentId', () => {
      const result = ExportReviewHistoryCsvSchema.safeParse({ assignmentId: 1 });
      expect(result.success).toBe(true);
    });

    it('should coerce string assignmentId to number', () => {
      const result = ExportReviewHistoryCsvSchema.safeParse({ assignmentId: '5' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.assignmentId).toBe(5);
      }
    });

    it('should reject missing assignmentId', () => {
      const result = ExportReviewHistoryCsvSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should reject non-positive assignmentId', () => {
      const result = ExportReviewHistoryCsvSchema.safeParse({ assignmentId: -1 });
      expect(result.success).toBe(false);
    });
  });
});
