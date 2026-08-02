import { resolveTimeZone } from '@/lib/timezone';

type DateStyle = 'short' | 'long' | 'time';

function formatDate(
  date: Date | string | null | undefined,
  locale: string,
  style: DateStyle,
  timeZone?: string,
): string {
  if (date === null || date === undefined) {
    return '';
  }

  const dateObj = typeof date === 'string' ? new Date(date) : date;

  const localeCode = locale === 'id' ? 'id-ID' : 'en-US';
  const timeZoneOption = timeZone === undefined ? {} : { timeZone: resolveTimeZone(timeZone) };

  switch (style) {
    case 'short':
      return dateObj.toLocaleDateString(localeCode, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        ...timeZoneOption,
      });
    case 'long':
      return dateObj.toLocaleDateString(localeCode, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        ...timeZoneOption,
      });
    case 'time':
      return dateObj.toLocaleString(localeCode, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        ...timeZoneOption,
      });
    default:
      return dateObj.toLocaleDateString(localeCode);
  }
}

export { formatDate };
