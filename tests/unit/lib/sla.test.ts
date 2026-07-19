/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { calculateBreachDuration } from '@/lib/sla';

describe('calculateBreachDuration', () => {
  const SLA_MS = 3 * 24 * 60 * 60 * 1000; // 72 hours

  it('should return 0 when reviewed within 3 days (no breach)', () => {
    const anchorTime = new Date('2026-06-01T12:00:00Z');
    const reviewedAt = new Date(anchorTime.getTime() + 2 * 24 * 60 * 60 * 1000); // 2 days later

    expect(calculateBreachDuration(anchorTime, reviewedAt)).toBe(0);
  });

  it('should return 0 when reviewed exactly at 3 days (boundary)', () => {
    const anchorTime = new Date('2026-06-01T12:00:00Z');
    const reviewedAt = new Date(anchorTime.getTime() + SLA_MS); // exactly 3 days

    expect(calculateBreachDuration(anchorTime, reviewedAt)).toBe(0);
  });

  it('should return breach days when reviewed after 3 days', () => {
    const anchorTime = new Date('2026-06-01T12:00:00Z');
    const reviewedAt = new Date(anchorTime.getTime() + 5 * 24 * 60 * 60 * 1000); // 5 days later

    // 5 days - 3 days SLA = 2 days breach
    expect(calculateBreachDuration(anchorTime, reviewedAt)).toBe(2);
  });

  it('should return breach days for a 45-day-old submission', () => {
    const anchorTime = new Date('2026-06-01T12:00:00Z');
    const reviewedAt = new Date(anchorTime.getTime() + 48 * 24 * 60 * 60 * 1000); // 48 days later

    // 48 days - 3 days SLA = 45 days breach
    expect(calculateBreachDuration(anchorTime, reviewedAt)).toBe(45);
  });

  it('should return breach for reviews completed well after SLA', () => {
    const anchorTime = new Date('2026-05-01T00:00:00Z');
    const reviewedAt = new Date('2026-06-01T00:00:00Z');

    // 31 days total - 3 day SLA = 28 days breach
    expect(calculateBreachDuration(anchorTime, reviewedAt)).toBe(28);
  });

  it('should return 0 when reviewed before anchor time', () => {
    const anchorTime = new Date('2026-06-05T12:00:00Z');
    const reviewedAt = new Date('2026-06-01T12:00:00Z'); // before anchor

    expect(calculateBreachDuration(anchorTime, reviewedAt)).toBe(0);
  });

  it('should return 0 for same-time review', () => {
    const anchorTime = new Date('2026-06-01T12:00:00Z');

    expect(calculateBreachDuration(anchorTime, anchorTime)).toBe(0);
  });

  it('should floor partial breach days', () => {
    const anchorTime = new Date('2026-06-01T12:00:00Z');
    // 3 days + 12 hours = 3.5 days elapsed → 0.5 days breach → floored to 0
    const reviewedAt = new Date(anchorTime.getTime() + SLA_MS + 12 * 60 * 60 * 1000);

    expect(calculateBreachDuration(anchorTime, reviewedAt)).toBe(0);
  });

  it('should floor partial breach days to whole days', () => {
    const anchorTime = new Date('2026-06-01T12:00:00Z');
    // 5 days + 18 hours = 5.75 days elapsed → 2.75 days breach → floored to 2
    const reviewedAt = new Date(
      anchorTime.getTime() + 5 * 24 * 60 * 60 * 1000 + 18 * 60 * 60 * 1000,
    );

    expect(calculateBreachDuration(anchorTime, reviewedAt)).toBe(2);
  });

  it('should handle millisecond precision edge cases', () => {
    const anchorTime = new Date('2026-05-20T10:00:00.000Z');
    const reviewedAt = new Date('2026-05-23T10:00:00.001Z');
    // 72h + 1ms → breach of 0 days (rounded down from <1 day)
    expect(calculateBreachDuration(anchorTime, reviewedAt)).toBe(0);
  });

  it('should return 1 day breach when 1ms over 4 days', () => {
    const anchorTime = new Date('2026-05-20T10:00:00.000Z');
    const reviewedAt = new Date('2026-05-24T10:00:00.001Z');
    // 4 days + 1ms - 3 day SLA = 1 day + 1ms → rounded down to 1 day
    expect(calculateBreachDuration(anchorTime, reviewedAt)).toBe(1);
  });

  it('should return 0 when anchorTime is null', () => {
    const reviewedAt = new Date('2026-06-05T12:00:00Z');

    expect(calculateBreachDuration(null as unknown as Date, reviewedAt)).toBe(0);
  });

  it('should return 0 when reviewedAt is null', () => {
    const anchorTime = new Date('2026-06-01T12:00:00Z');

    expect(calculateBreachDuration(anchorTime, null as unknown as Date)).toBe(0);
  });

  it('should return 0 when both arguments are null', () => {
    expect(calculateBreachDuration(null as unknown as Date, null as unknown as Date)).toBe(0);
  });

  it('should return 0 when both arguments are undefined', () => {
    expect(
      calculateBreachDuration(undefined as unknown as Date, undefined as unknown as Date),
    ).toBe(0);
  });
});
