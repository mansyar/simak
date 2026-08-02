import { describe, it, expect } from 'vitest';

import { formatDate } from '@/lib/format-date';

describe('formatDate', () => {
  const testDate = new Date('2026-06-15T10:30:00Z');

  it('formats short style with en locale', () => {
    const result = formatDate(testDate, 'en', 'short');
    expect(result).toMatch(/Jun 15, 2026/);
  });

  it('formats short style with id locale', () => {
    const result = formatDate(testDate, 'id', 'short');
    // id locale uses different date format
    expect(result).toBeTruthy();
    expect(result).not.toBe('');
  });

  it('formats long style with en locale', () => {
    const result = formatDate(testDate, 'en', 'long');
    expect(result).toMatch(/June 15, 2026/);
  });

  it('formats time style with en locale', () => {
    const result = formatDate(testDate, 'en', 'time');
    expect(result).toBeTruthy();
    expect(result).toContain(':');
  });

  it('handles Date object input', () => {
    const result = formatDate(testDate, 'en', 'short');
    expect(result).toBeTruthy();
  });

  it('handles string input', () => {
    const result = formatDate('2026-06-15T10:30:00Z', 'en', 'short');
    expect(result).toMatch(/Jun 15, 2026/);
  });

  it('handles null input', () => {
    const result = formatDate(null, 'en', 'short');
    expect(result).toBe('');
  });

  it('handles undefined input', () => {
    const result = formatDate(undefined, 'en', 'short');
    expect(result).toBe('');
  });

  it('handles invalid date string', () => {
    const result = formatDate('not-a-date', 'en', 'short');
    expect(result).toBe('Invalid Date');
  });

  it('formats an instant in an explicit timezone', () => {
    const result = formatDate(testDate, 'en', 'time', 'America/Los_Angeles');
    expect(result).toContain('Jun 15, 2026');
    expect(result).toContain('3:30');
  });

  it('uses UTC when an explicit timezone is invalid', () => {
    const result = formatDate('2026-01-01T00:30:00Z', 'en', 'short', 'Mars/Phobos');
    expect(result).toContain('Jan 1, 2026');
  });

  it('keeps null and invalid values stable with an explicit timezone', () => {
    expect(formatDate(null, 'en', 'short', 'Asia/Jakarta')).toBe('');
    expect(formatDate('not-a-date', 'en', 'short', 'Asia/Jakarta')).toBe('Invalid Date');
  });
});
