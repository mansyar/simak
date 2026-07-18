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
