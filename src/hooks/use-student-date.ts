import { useCallback } from 'react';
import { formatDate } from '@/lib/format-date';
import { formatDateShort } from '@/lib/format';
import { useStudentTimezone } from '@/hooks/use-student-timezone';

type StudentDate = Date | string;
type StudentDateStyle = 'short' | 'long' | 'time';
type StudentLocale = 'en' | 'id';

export function useStudentDateFormatter(locale: StudentLocale) {
  const { timezone, hydrated } = useStudentTimezone();

  const format = useCallback(
    (date: StudentDate | null | undefined, style: StudentDateStyle = 'short') => {
      if (date === null || date === undefined) return '';
      return hydrated ? formatDate(date, locale, style, timezone) : '—';
    },
    [hydrated, locale, timezone],
  );

  const formatShort = useCallback(
    (date: StudentDate) => (hydrated ? formatDateShort(date, locale, timezone) : '—'),
    [hydrated, locale, timezone],
  );

  return { format, formatShort, hydrated, timezone };
}
