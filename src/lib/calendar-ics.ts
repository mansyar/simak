const encoder = new TextEncoder();

export type CalendarIcsEvent = {
  uid: string;
  summary: string;
  startsAt: Date;
  endsAt?: Date;
};

function formatUtcDate(value: Date) {
  const year = value.getUTCFullYear().toString().padStart(4, '0');
  const month = (value.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = value.getUTCDate().toString().padStart(2, '0');
  const hours = value.getUTCHours().toString().padStart(2, '0');
  const minutes = value.getUTCMinutes().toString().padStart(2, '0');
  const seconds = value.getUTCSeconds().toString().padStart(2, '0');

  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

function escapeText(value: string) {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll('\r\n', '\\n')
    .replaceAll('\r', '\\n')
    .replaceAll('\n', '\\n')
    .replaceAll(';', '\\;')
    .replaceAll(',', '\\,');
}

function foldLine(line: string) {
  const segments: string[] = [];
  let segment = '';
  let maxBytes = 75;

  for (const character of line) {
    if (segment && encoder.encode(`${segment}${character}`).length > maxBytes) {
      segments.push(segment);
      segment = character;
      maxBytes = 74;
    } else {
      segment += character;
    }
  }

  if (segment) {
    segments.push(segment);
  }

  return segments.map((value, index) => (index === 0 ? value : ` ${value}`));
}

export function serializeCalendarFeed(events: CalendarIcsEvent[], generatedAt: Date) {
  const logicalLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SIMAK//Student Deadlines//EN',
    'CALSCALE:GREGORIAN',
  ];

  for (const event of events) {
    logicalLines.push(
      'BEGIN:VEVENT',
      `UID:${escapeText(event.uid)}`,
      `DTSTAMP:${formatUtcDate(generatedAt)}`,
    );
    logicalLines.push(`DTSTART:${formatUtcDate(event.startsAt)}`);
    if (event.endsAt) {
      logicalLines.push(`DTEND:${formatUtcDate(event.endsAt)}`);
    }
    logicalLines.push(`SUMMARY:${escapeText(event.summary)}`, 'END:VEVENT');
  }

  logicalLines.push('END:VCALENDAR');

  return `${logicalLines.flatMap(foldLine).join('\r\n')}\r\n`;
}
