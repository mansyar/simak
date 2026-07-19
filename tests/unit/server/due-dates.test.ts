/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  calculateDueDates,
  validateDueDates,
  computeEffectiveDeadline,
} from '@/server/due-dates.server';

describe('calculateDueDates', () => {
  it('should calculate cumulative dueDates for 3 checkpoints', () => {
    const baseDate = new Date('2026-06-01T00:00:00Z');
    const checkpoints = [
      { order: 1, estimatedDuration: 7 },
      { order: 2, estimatedDuration: 14 },
      { order: 3, estimatedDuration: 21 },
    ];

    const result = calculateDueDates(checkpoints, baseDate);

    expect(result.get(1)!.toISOString().slice(0, 10)).toBe('2026-06-08'); // +7
    expect(result.get(2)!.toISOString().slice(0, 10)).toBe('2026-06-22'); // +21
    expect(result.get(3)!.toISOString().slice(0, 10)).toBe('2026-07-13'); // +42
  });

  it('should handle zero estimated_duration', () => {
    const baseDate = new Date('2026-06-01T00:00:00Z');
    const checkpoints = [
      { order: 1, estimatedDuration: 0 },
      { order: 2, estimatedDuration: 7 },
    ];

    const result = calculateDueDates(checkpoints, baseDate);

    expect(result.get(1)!.toISOString().slice(0, 10)).toBe('2026-06-01'); // +0
    expect(result.get(2)!.toISOString().slice(0, 10)).toBe('2026-06-08'); // +7
  });

  it('should handle null estimated_duration as 0', () => {
    const baseDate = new Date('2026-06-01T00:00:00Z');
    const checkpoints = [{ order: 1, estimatedDuration: null }];

    const result = calculateDueDates(checkpoints, baseDate);

    expect(result.get(1)!.toISOString().slice(0, 10)).toBe('2026-06-01');
  });
});

describe('validateDueDates', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should accept valid sequential order', () => {
    const dueDates = new Map([
      [1, new Date('2026-07-01')],
      [2, new Date('2026-07-15')],
      [3, new Date('2026-08-01')],
    ]);

    const result = validateDueDates(dueDates);
    expect(result).toEqual({ valid: true });
  });

  it('should reject out-of-order dueDates', () => {
    const dueDates = new Map([
      [1, new Date('2026-07-01')],
      [2, new Date('2026-06-20')],
    ]);

    const result = validateDueDates(dueDates);
    expect(result).not.toEqual({ valid: true });
    if (!result.valid) {
      expect(result.error).toContain('dueDate must be after');
    }
  });

  it('should accept same-day dueDates (equal)', () => {
    const dueDates = new Map([
      [1, new Date('2026-06-20')],
      [2, new Date('2026-06-20')],
    ]);

    const result = validateDueDates(dueDates);
    expect(result).not.toEqual({ valid: true });
  });

  it('should reject past dueDates', () => {
    const dueDates = new Map([[1, new Date('2020-01-01')]]);

    const result = validateDueDates(dueDates);
    expect(result).not.toEqual({ valid: true });
    if (!result.valid) {
      expect(result.error).toContain('must not be in the past');
    }
  });

  it('should accept future dates', () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    const dueDates = new Map([[1, future]]);

    const result = validateDueDates(dueDates);
    expect(result).toEqual({ valid: true });
  });

  // BUG-12: finalDeadline cap
  it('should reject checkpoint dueDate exceeding finalDeadline when provided', () => {
    const dueDates = new Map([
      [1, new Date('2026-08-01')],
      [2, new Date('2026-09-01')],
    ]);
    const finalDeadline = new Date('2026-08-15');

    const result = validateDueDates(dueDates, finalDeadline);
    expect(result).not.toEqual({ valid: true });
    if (!result.valid) {
      expect(result.error).toContain('finalDeadline');
      expect(result.error).toContain('2');
    }
  });

  it('should accept checkpoint dueDates at or before finalDeadline', () => {
    const dueDates = new Map([
      [1, new Date('2026-07-01')],
      [2, new Date('2026-08-01')],
    ]);
    const finalDeadline = new Date('2026-08-01');

    const result = validateDueDates(dueDates, finalDeadline);
    expect(result).toEqual({ valid: true });
  });

  it('should NOT enforce finalDeadline cap when not provided (backward compatible)', () => {
    const dueDates = new Map([
      [1, new Date('2026-07-01')],
      [2, new Date('2026-12-01')],
    ]);

    const result = validateDueDates(dueDates);
    expect(result).toEqual({ valid: true });
  });
});

// BUG-28: computeEffectiveDeadline helper
describe('computeEffectiveDeadline', () => {
  it('should return the first non-passed checkpoint dueDate (mixed statuses)', () => {
    const checkpoints = [
      { state: 'passed', dueDate: new Date('2026-03-01'), order: 1 },
      { state: 'unlocked', dueDate: new Date('2026-04-01'), order: 2 },
      { state: 'locked', dueDate: new Date('2026-05-01'), order: 3 },
    ];

    const result = computeEffectiveDeadline(checkpoints);
    expect(result).toEqual(new Date('2026-04-01'));
  });

  it('should return the last checkpoint dueDate when all are passed', () => {
    const checkpoints = [
      { state: 'passed', dueDate: new Date('2026-03-01'), order: 1 },
      { state: 'passed', dueDate: new Date('2026-04-01'), order: 2 },
      { state: 'passed', dueDate: new Date('2026-05-01'), order: 3 },
    ];

    const result = computeEffectiveDeadline(checkpoints);
    expect(result).toEqual(new Date('2026-05-01'));
  });

  it('should return null for empty checkpoints array', () => {
    const result = computeEffectiveDeadline([]);
    expect(result).toBeNull();
  });

  it('should sort checkpoints by order before finding first non-passed', () => {
    // Checkpoints provided out of order
    const checkpoints = [
      { state: 'locked', dueDate: new Date('2026-05-01'), order: 3 },
      { state: 'passed', dueDate: new Date('2026-03-01'), order: 1 },
      { state: 'unlocked', dueDate: new Date('2026-04-01'), order: 2 },
    ];

    const result = computeEffectiveDeadline(checkpoints);
    expect(result).toEqual(new Date('2026-04-01'));
  });

  it('should return the first checkpoint dueDate when no checkpoints are passed', () => {
    const checkpoints = [
      { state: 'unlocked', dueDate: new Date('2026-04-01'), order: 1 },
      { state: 'locked', dueDate: new Date('2026-05-01'), order: 2 },
    ];

    const result = computeEffectiveDeadline(checkpoints);
    expect(result).toEqual(new Date('2026-04-01'));
  });

  it('should handle null dueDate on the first non-passed checkpoint', () => {
    const checkpoints = [
      { state: 'passed', dueDate: new Date('2026-03-01'), order: 1 },
      { state: 'unlocked', dueDate: null, order: 2 },
      { state: 'locked', dueDate: new Date('2026-05-01'), order: 3 },
    ];

    const result = computeEffectiveDeadline(checkpoints);
    expect(result).toBeNull();
  });

  it('should handle a single non-passed checkpoint', () => {
    const checkpoints = [{ state: 'unlocked', dueDate: new Date('2026-04-01'), order: 1 }];

    const result = computeEffectiveDeadline(checkpoints);
    expect(result).toEqual(new Date('2026-04-01'));
  });

  it('should handle a single passed checkpoint', () => {
    const checkpoints = [{ state: 'passed', dueDate: new Date('2026-03-01'), order: 1 }];

    const result = computeEffectiveDeadline(checkpoints);
    expect(result).toEqual(new Date('2026-03-01'));
  });
});
