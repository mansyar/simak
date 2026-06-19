import { describe, it, expect } from 'vitest';
import { formatDateShort, formatDateLong, formatDateTimeShort } from '@/lib/format';
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
});
