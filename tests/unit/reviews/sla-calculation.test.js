/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { calculateBreachDuration } from '@/lib/sla';
describe('calculateBreachDuration', () => {
  it('should return 0 when review is completed exactly at 3 days (72h)', () => {
    const underReviewAt = new Date('2026-05-20T10:00:00Z');
    const reviewedAt = new Date('2026-05-23T10:00:00Z');
    expect(calculateBreachDuration(underReviewAt, reviewedAt)).toBe(0);
  });
  it('should return 0 when review is completed within 3 days', () => {
    const underReviewAt = new Date('2026-05-20T10:00:00Z');
    const reviewedAt = new Date('2026-05-22T15:30:00Z');
    expect(calculateBreachDuration(underReviewAt, reviewedAt)).toBe(0);
  });
  it('should return positive breach days when review is late', () => {
    const underReviewAt = new Date('2026-05-20T10:00:00Z');
    const reviewedAt = new Date('2026-05-26T10:00:00Z');
    // Breach = 3 days overdue (May 26 - May 20 = 6 days - 3 day SLA = 3 days)
    expect(calculateBreachDuration(underReviewAt, reviewedAt)).toBe(3);
  });
  it('should round down breach duration to whole days', () => {
    const underReviewAt = new Date('2026-05-20T10:00:00Z');
    const reviewedAt = new Date('2026-05-25T10:30:00Z');
    // Breach = 5 days 30 min - 3 days = 2 days 30 min, rounded down = 2
    expect(calculateBreachDuration(underReviewAt, reviewedAt)).toBe(2);
  });
  it('should handle millisecond precision edge cases', () => {
    const underReviewAt = new Date('2026-05-20T10:00:00.000Z');
    const reviewedAt = new Date('2026-05-23T10:00:00.001Z');
    // 72h + 1ms → breach of 0 days (rounded down from <1 day)
    expect(calculateBreachDuration(underReviewAt, reviewedAt)).toBe(0);
  });
  it('should return 1 day breach when 1ms over 4 days', () => {
    const underReviewAt = new Date('2026-05-20T10:00:00.000Z');
    const reviewedAt = new Date('2026-05-24T10:00:00.001Z');
    // 4 days + 1ms - 3 day SLA = 1 day + 1ms → rounded down to 1 day
    expect(calculateBreachDuration(underReviewAt, reviewedAt)).toBe(1);
  });
  it('should return 0 for reviews completed before 3 days', () => {
    const underReviewAt = new Date('2026-05-20T10:00:00Z');
    const reviewedAt = new Date('2026-05-21T09:00:00Z');
    expect(calculateBreachDuration(underReviewAt, reviewedAt)).toBe(0);
  });
  it('should return breach for reviews completed well after SLA', () => {
    const underReviewAt = new Date('2026-05-01T00:00:00Z');
    const reviewedAt = new Date('2026-06-01T00:00:00Z');
    // 31 days total - 3 day SLA = 28 days breach
    expect(calculateBreachDuration(underReviewAt, reviewedAt)).toBe(28);
  });
  it('should return 0 when reviewedAt is before underReviewAt (edge case)', () => {
    const underReviewAt = new Date('2026-05-20T10:00:00Z');
    const reviewedAt = new Date('2026-05-19T10:00:00Z');
    expect(calculateBreachDuration(underReviewAt, reviewedAt)).toBe(0);
  });
  it('should handle undefined reviewedAt gracefully', () => {
    const underReviewAt = new Date('2026-05-20T10:00:00Z');
    expect(calculateBreachDuration(underReviewAt, undefined)).toBe(0);
  });
  it('should handle null underReviewAt gracefully', () => {
    const reviewedAt = new Date('2026-05-23T10:00:00Z');
    expect(calculateBreachDuration(null, reviewedAt)).toBe(0);
  });
});
