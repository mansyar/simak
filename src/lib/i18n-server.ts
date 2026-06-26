import type { Locales } from '../i18n/types';
import enTranslations from '../../locales/en.json';
import idTranslations from '../../locales/id.json';

type TranslationRecord = { [key: string]: string | TranslationRecord };

const translations: Record<Locales, TranslationRecord> = {
  en: enTranslations as TranslationRecord,
  id: idTranslations as TranslationRecord,
};

function resolveKey(obj: TranslationRecord, key: string): string {
  const parts = key.split('.');
  let current: TranslationRecord | string = obj;
  for (const part of parts) {
    if (typeof current === 'object' && current !== null && part in current) {
      current = current[part];
    } else {
      return key;
    }
  }
  return typeof current === 'string' ? current : key;
}

function interpolate(text: string, params?: Record<string, string>): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (_, p) => params[p] ?? `{${p}}`);
}

export function resolveNotificationContent(
  titleKey: string,
  messageKey: string | null,
  params: Record<string, string> | null,
  locale: Locales,
) {
  return {
    title: interpolate(resolveKey(translations[locale], titleKey), params ?? undefined),
    message: messageKey
      ? interpolate(resolveKey(translations[locale], messageKey), params ?? undefined)
      : null,
  };
}

export function getNotificationKeys(type: string) {
  return {
    titleKey: `notifications.events.${type}.title`,
    messageKey: `notifications.events.${type}.message`,
  };
}

export function resolveEmailSubject(
  key: string,
  params?: Record<string, string>,
  locale: Locales = 'en',
): string {
  return interpolate(resolveKey(translations[locale], key), params);
}
