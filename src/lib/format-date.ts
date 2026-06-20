type DateStyle = 'short' | 'long' | 'time';

function formatDate(
  date: Date | string | null | undefined,
  locale: string,
  style: DateStyle,
): string {
  if (date === null || date === undefined) {
    return '';
  }

  const dateObj = typeof date === 'string' ? new Date(date) : date;

  const localeCode = locale === 'id' ? 'id-ID' : 'en-US';

  switch (style) {
    case 'short':
      return dateObj.toLocaleDateString(localeCode, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    case 'long':
      return dateObj.toLocaleDateString(localeCode, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    case 'time':
      return dateObj.toLocaleString(localeCode, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    default:
      return dateObj.toLocaleDateString(localeCode);
  }
}

export { formatDate };
