import { describe, expect, it } from 'vitest';
import { serializeCalendarFeed, type CalendarIcsEvent } from '@/lib/calendar-ics';

const generatedAt = new Date('2026-08-03T09:10:11.000Z');

function event(overrides: Partial<CalendarIcsEvent> = {}): CalendarIcsEvent {
  return {
    uid: 'checkpoint-11@simak',
    summary: 'Research Project — Proposal',
    startsAt: new Date('2026-11-01T08:30:00.000Z'),
    ...overrides,
  };
}

describe('serializeCalendarFeed', () => {
  it('serializes UTC timed events with stable UIDs and deterministic DTSTAMP', () => {
    const feed = serializeCalendarFeed([event()], generatedAt);

    expect(feed).toContain('BEGIN:VCALENDAR\r\n');
    expect(feed).toContain('VERSION:2.0\r\n');
    expect(feed).toContain('PRODID:-//SIMAK//Student Deadlines//EN\r\n');
    expect(feed).toContain('BEGIN:VEVENT\r\n');
    expect(feed).toContain('UID:checkpoint-11@simak\r\n');
    expect(feed).toContain('DTSTAMP:20260803T091011Z\r\n');
    expect(feed).toContain('DTSTART:20261101T083000Z\r\n');
    expect(feed).toContain('SUMMARY:Research Project — Proposal\r\n');
    expect(feed).toContain('END:VEVENT\r\nEND:VCALENDAR\r\n');
  });

  it('escapes text, preserves Unicode, folds long lines, and uses CRLF only', () => {
    const summary = `Résumé, Phase; \\ "quoted"\n${'é'.repeat(100)}`;
    const feed = serializeCalendarFeed([event({ summary })], generatedAt);
    const lines = feed.split('\r\n').filter(Boolean);
    const unfoldedSummary = lines
      .reduce<string[]>((result, line) => {
        if (line.startsWith(' ') && result.length > 0) {
          result[result.length - 1] += line.slice(1);
        } else {
          result.push(line);
        }
        return result;
      }, [])
      .find((line) => line.startsWith('SUMMARY:'));

    expect(unfoldedSummary).toBe(
      'SUMMARY:Résumé\\, Phase\\; \\\\ "quoted"\\né'.replace(/é$/, '') + 'é'.repeat(100),
    );
    expect(lines.some((line) => line.startsWith(' '))).toBe(true);
    expect(lines.every((line) => new TextEncoder().encode(line).length <= 75)).toBe(true);
    expect(feed.includes('\n') && !feed.includes('\r\n')).toBe(false);
  });

  it('serializes empty, overdue, and locked-event feeds', () => {
    const emptyFeed = serializeCalendarFeed([], generatedAt);
    const eventFeed = serializeCalendarFeed(
      [
        event({ uid: 'checkpoint-overdue@simak', startsAt: new Date('2020-01-01T00:00:00Z') }),
        event({ uid: 'checkpoint-locked@simak', startsAt: new Date('2030-01-01T00:00:00Z') }),
      ],
      generatedAt,
    );

    expect(emptyFeed).toBe(
      'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//SIMAK//Student Deadlines//EN\r\n' +
        'CALSCALE:GREGORIAN\r\nEND:VCALENDAR\r\n',
    );
    expect(eventFeed).toContain('UID:checkpoint-overdue@simak\r\n');
    expect(eventFeed).toContain('UID:checkpoint-locked@simak\r\n');
    expect(eventFeed).not.toContain('token');
  });
});
