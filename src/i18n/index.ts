// Import generated types
import type { Locales, Translation, TranslationFunctions } from './types'
import { detectLocale as detectLocaleFn } from './detect-locale'

export type { Locales, Translation, TranslationFunctions }

const FALLBACK_LOCALE: Locales = 'en'

function getBrowserLocale(): string | null {
  if (typeof navigator === 'undefined') return null
  const lang = navigator.language
  if (lang.startsWith('id')) return 'id'
  if (lang.startsWith('en')) return 'en'
  return null
}

function getStoredLocale(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('simak-locale')
}

export function detectLocale(): Locales {
  const stored = getStoredLocale()
  if (stored && (stored === 'en' || stored === 'id')) return stored

  const browser = getBrowserLocale()
  if (browser && (browser === 'en' || browser === 'id')) return browser as Locales

  return FALLBACK_LOCALE
}

// Placeholder for typesafe-i18n initialization
// Complete i18n setup will be implemented with typesafe-i18n generator
export type { LocaleTranslation } from './types'
