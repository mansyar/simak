import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  formatDateShort,
  formatDateLong,
  formatDateTimeShort,
  formatRelativeTime,
} from '@/lib/format';

describe('formatDate helpers', () => {
  const testDate = new Date('2026-03-05T14:30:00');
  const testISOString = '2026-03-05T14:30:00';

  describe('formatDateShort', () => {
    it('formats date in English locale', () => {
      const result = formatDateShort(testDate, 'en');
      expect(result).toBe('Mar 5, 2026');
    });

    it('formats date in Indonesian locale', () => {
      const result = formatDateShort(testDate, 'id');
      expect(result).toBe('5 Mar 2026');
    });

    it('accepts ISO string input', () => {
      const result = formatDateShort(testISOString, 'en');
      expect(result).toBe('Mar 5, 2026');
    });

    it('handles invalid date gracefully', () => {
      const result = formatDateShort('invalid-date', 'en');
      expect(result).toBe('Invalid Date');
    });
  });

  describe('formatDateLong', () => {
    it('formats date in English locale', () => {
      const result = formatDateLong(testDate, 'en');
      expect(result).toBe('March 5, 2026');
    });

    it('formats date in Indonesian locale', () => {
      const result = formatDateLong(testDate, 'id');
      expect(result).toBe('5 Maret 2026');
    });

    it('accepts ISO string input', () => {
      const result = formatDateLong(testISOString, 'en');
      expect(result).toBe('March 5, 2026');
    });
  });

  describe('formatDateTimeShort', () => {
    it('formats date and time in English locale (12h)', () => {
      const result = formatDateTimeShort(testDate, 'en');
      expect(result).toBe('Mar 5, 2026 2:30 PM');
    });

    it('formats date and time in Indonesian locale (24h)', () => {
      const result = formatDateTimeShort(testDate, 'id');
      expect(result).toBe('5 Mar 2026 14:30');
    });

    it('accepts ISO string input', () => {
      const result = formatDateTimeShort(testISOString, 'en');
      expect(result).toBe('Mar 5, 2026 2:30 PM');
    });
  });

  describe('formatRelativeTime', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-03-05T14:30:00'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns "in 3 days" for a date 3 days in the future (en)', () => {
      const futureDate = new Date('2026-03-08T14:30:00');
      const result = formatRelativeTime(futureDate, 'en');
      expect(result).toBe('in 3 days');
    });

    it('returns "3 days ago" for a date 3 days in the past (en)', () => {
      const pastDate = new Date('2026-03-02T14:30:00');
      const result = formatRelativeTime(pastDate, 'en');
      expect(result).toBe('3 days ago');
    });

    it('returns Indonesian locale string for future date', () => {
      const futureDate = new Date('2026-03-08T14:30:00');
      const result = formatRelativeTime(futureDate, 'id');
      expect(result).toBe('dalam waktu 3 hari');
    });

    it('returns Indonesian locale string for past date', () => {
      const pastDate = new Date('2026-03-02T14:30:00');
      const result = formatRelativeTime(pastDate, 'id');
      expect(result).toBe('3 hari yang lalu');
    });

    it('accepts ISO string input', () => {
      const result = formatRelativeTime('2026-03-08T14:30:00', 'en');
      expect(result).toBe('in 3 days');
    });

    it('handles invalid date gracefully', () => {
      const result = formatRelativeTime('invalid-date', 'en');
      expect(result).toBe('Invalid Date');
    });

    it('defaults to English locale', () => {
      const futureDate = new Date('2026-03-08T14:30:00');
      const result = formatRelativeTime(futureDate);
      expect(result).toBe('in 3 days');
    });
  });
});
