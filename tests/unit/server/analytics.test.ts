/** @vitest-environment node */
import { describe, it, expect, vi } from 'vitest';

// Mock createServerFn before importing
vi.mock('@tanstack/react-start', () => ({
  createServerFn: vi.fn().mockReturnValue({
    inputValidator: vi.fn().mockReturnThis(),
    handler: vi.fn().mockImplementation((fn) => fn),
  }),
}));

import { AnalyticsDateRangeSchema } from '@/server/analytics';

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
  });
});
