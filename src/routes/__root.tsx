/// <reference types="vite/client" />
import type { ReactNode } from 'react';
import { Outlet, createRootRoute, HeadContent, Scripts } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import globalCss from '../app/global.css?url';
import type { Locales } from '../i18n/types';

const queryClient = new QueryClient();

// Placeholder ThemeProvider — replaces the hook-based approach for SSR compatibility
function ThemeScript() {
  return (
    <script
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

// Placeholder i18n provider context
import { createContext, useContext } from 'react';

type I18nContextType = {
  locale: Locales;
  setLocale: (locale: Locales) => void;
  t: (key: string) => string;
};

const I18nContext = createContext<I18nContextType>({
  locale: 'en',
  setLocale: () => {},
  t: (key: string) => key,
});

export function useI18n() {
  return useContext(I18nContext);
}

export const Route = createRootRoute({
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
  return (
    <html>
      <head>
        <ThemeScript />
        <HeadContent />
      </head>
      <body>
        <div id="skip-to-content">
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-white focus:text-black focus:rounded"
          >
            Skip to content
          </a>
        </div>
        <QueryClientProvider client={queryClient}>
          <I18nContext.Provider
            value={{ locale: 'en', setLocale: () => {}, t: (key: string) => key }}
          >
            {children}
          </I18nContext.Provider>
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  );
}
