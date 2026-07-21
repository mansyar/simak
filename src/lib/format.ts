import { format, parseISO, isValid, formatDistanceToNow } from 'date-fns';
import { enUS, id } from 'date-fns/locale';

type Locale = 'en' | 'id';

const localeMap: Record<Locale, typeof enUS> = {
  en: enUS,
  id: id,
};

function toDate(date: Date | string): Date {
  if (typeof date === 'string') {
    return parseISO(date);
  }
  return date;
}

/**
 * Format date as "Mar 5, 2026" (EN) or "5 Mar 2026" (ID)
 */
export function formatDateShort(date: Date | string, locale: Locale = 'en'): string {
  const d = toDate(date);
  if (!isValid(d)) return 'Invalid Date';
  return format(d, locale === 'id' ? 'd MMM yyyy' : 'MMM d, yyyy', {
    locale: localeMap[locale],
  });
}

/**
 * Format date as "March 5, 2026" (EN) or "5 Maret 2026" (ID)
 */
export function formatDateLong(date: Date | string, locale: Locale = 'en'): string {
  const d = toDate(date);
  if (!isValid(d)) return 'Invalid Date';
  return format(d, locale === 'id' ? 'd MMMM yyyy' : 'MMMM d, yyyy', {
    locale: localeMap[locale],
  });
}

/**
 * Format date and time as "Mar 5, 2026 2:30 PM" (EN, 12h) or "5 Mar 2026 14:30" (ID, 24h)
 */
export function formatDateTimeShort(date: Date | string, locale: Locale = 'en'): string {
  const d = toDate(date);
  if (!isValid(d)) return 'Invalid Date';
  return format(d, locale === 'id' ? 'd MMM yyyy HH:mm' : 'MMM d, yyyy h:mm a', {
    locale: localeMap[locale],
  });
}

/**
 * Format relative time as "in 3 days" (EN) or "dalam 3 hari" (ID)
 */
export function formatRelativeTime(date: Date | string, locale: Locale = 'en'): string {
  const d = toDate(date);
  if (!isValid(d)) return 'Invalid Date';
  return formatDistanceToNow(d, { addSuffix: true, locale: localeMap[locale] });
}
