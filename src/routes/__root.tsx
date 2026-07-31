/// <reference types="vite/client" />
import { useState, createContext, useContext, useCallback } from 'react';
import type { ReactNode } from 'react';
import { Outlet, createRootRoute, HeadContent, Scripts, useRouter } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '../components/ui/sonner';
import { RootErrorComponent } from '../components/error-boundary';
import globalCss from '../app/global.css?url';
import type { Locales } from '../i18n/types';
import { detectLocale } from '../i18n/index';
import type { TranslationKey } from '../i18n/index';
import enTranslations from '../../locales/en.json';
import idTranslations from '../../locales/id.json';

const queryClient = new QueryClient();

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

// Placeholder ThemeProvider — replaces the hook-based approach for SSR compatibility
function ThemeScript() {
  const nonce = useRouter().options.ssr?.nonce;

  return (
    <script
      nonce={nonce}
      dangerouslySetInnerHTML={{
        __html: `
          (function() {
            try {
              var theme = localStorage.getItem('simak-theme');
              if (!theme) {
                theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
              }
              if (theme === 'dark') {
                document.documentElement.classList.add('dark');
              }
            } catch(e) {}
          })();
        `,
      }}
    />
  );
}

// i18n provider context
type I18nContextType = {
  locale: Locales;
  setLocale: (locale: Locales) => void;
  t: (key: TranslationKey, params?: Record<string, string>) => string;
};

const I18nContext = createContext<I18nContextType>({
  locale: 'en',
  setLocale: () => {},
  t: (_key: string) => _key,
});

export function useI18n() {
  return useContext(I18nContext);
}

function useI18nProvider() {
  const [locale, setLocaleState] = useState<Locales>(() => {
    if (typeof window === 'undefined') return 'en';
    return detectLocale();
  });

  const setLocale = useCallback((newLocale: Locales) => {
    setLocaleState(newLocale);
    if (typeof window !== 'undefined') {
      localStorage.setItem('simak-locale', newLocale);
    }
  }, []);

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string>): string => {
      const raw = resolveKey(translations[locale], key);
      return interpolate(raw, params);
    },
    [locale],
  );

  return { locale, setLocale, t };
}

export function NotFoundComponent() {
  const { t } = useI18n();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
      <h1 className="text-4xl font-bold text-foreground">404</h1>
      <p className="text-lg text-muted-foreground">{t('error.notFound')}</p>
      <a href="/" className="text-primary hover:underline">
        {t('common.goHome')}
      </a>
    </div>
  );
}

export const Route = createRootRoute({
  notFoundComponent: NotFoundComponent,
  errorComponent: RootErrorComponent,
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'SIMAK — Sistem Informasi dan Manajemen Akademik',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: globalCss,
      },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  const i18n = useI18nProvider();

  return (
    <html lang={i18n.locale}>
      <head>
        <ThemeScript />
        <HeadContent />
      </head>
      <body>
        <div id="skip-to-content">
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-background focus:text-foreground focus:rounded"
          >
            {i18n.t('common.skipToContent')}
          </a>
        </div>
        <QueryClientProvider client={queryClient}>
          <I18nContext.Provider value={i18n}>
            {children}
            <Toaster richColors position="top-right" />
          </I18nContext.Provider>
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  );
}
