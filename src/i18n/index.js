const FALLBACK_LOCALE = 'en';
function getBrowserLocale() {
  if (typeof navigator === 'undefined') return null;
  const lang = navigator.language;
  if (lang.startsWith('id')) return 'id';
  if (lang.startsWith('en')) return 'en';
  return null;
}
function getStoredLocale() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('simak-locale');
}
export function detectLocale() {
  const stored = getStoredLocale();
  if (stored && (stored === 'en' || stored === 'id')) return stored;
  const browser = getBrowserLocale();
  if (browser && (browser === 'en' || browser === 'id')) return browser;
  return FALLBACK_LOCALE;
}
