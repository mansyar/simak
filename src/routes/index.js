import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useI18n } from './__root';
import { Layers, MessageSquare, Users, Clock, Globe, Shield } from 'lucide-react';
export const Route = createFileRoute('/')({
  component: HomePage,
});
const features = [
  { key: 'sequentialCheckpoints', Icon: Layers },
  { key: 'structuredFeedback', Icon: MessageSquare },
  { key: 'consultationTracking', Icon: Users },
  { key: 'deadlineManagement', Icon: Clock },
  { key: 'bilingualSupport', Icon: Globe },
  { key: 'roleBasedAccess', Icon: Shield },
];
const steps = ['step1', 'step2', 'step3'];
export function HomePage() {
  const { t } = useI18n();
  return _jsxs('div', {
    className: 'flex min-h-screen flex-col',
    children: [
      _jsxs('section', {
        id: 'hero',
        className: 'relative flex flex-col items-center justify-center px-6 py-24 text-center',
        children: [
          _jsxs('div', {
            className: 'pointer-events-none absolute inset-0 overflow-hidden',
            children: [
              _jsx('div', {
                className:
                  'absolute -top-40 -right-40 h-80 w-80 rounded-full bg-[#6B5CE7]/10 blur-3xl',
              }),
              _jsx('div', {
                className:
                  'absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-[#34D399]/10 blur-3xl',
              }),
            ],
          }),
          _jsxs('div', {
            className: 'relative z-10 mx-auto max-w-3xl',
            children: [
              _jsx('h1', {
                className:
                  'text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl',
                children: t('landing.hero.headline'),
              }),
              _jsx('p', {
                className: 'mt-6 text-lg text-muted-foreground sm:text-xl',
                children: t('landing.hero.subheadline'),
              }),
              _jsx('div', {
                className: 'mt-8',
                children: _jsx(Link, {
                  to: '/auth/login',
                  className:
                    'inline-flex h-12 items-center rounded-lg bg-[#6B5CE7] px-8 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-[#5a4bd6]',
                  children: t('landing.hero.cta'),
                }),
              }),
            ],
          }),
        ],
      }),
      _jsx('section', {
        id: 'features',
        className: 'bg-muted/50 px-6 py-20',
        children: _jsxs('div', {
          className: 'mx-auto max-w-5xl',
          children: [
            _jsxs('div', {
              className: 'text-center',
              children: [
                _jsx('h2', {
                  className: 'text-3xl font-bold text-foreground',
                  children: t('landing.features.title'),
                }),
                _jsx('p', {
                  className: 'mt-3 text-muted-foreground',
                  children: t('landing.features.subtitle'),
                }),
              ],
            }),
            _jsx('div', {
              className: 'mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3',
              children: features.map(({ key, Icon }) =>
                _jsxs(
                  'div',
                  {
                    className:
                      'rounded-xl border bg-background p-6 shadow-sm transition-shadow hover:shadow-md',
                    children: [
                      _jsx('div', {
                        className:
                          'mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-[#6B5CE7]/10',
                        children: _jsx(Icon, { className: 'h-5 w-5 text-[#6B5CE7]' }),
                      }),
                      _jsx('h3', {
                        className: 'font-semibold text-foreground',
                        children: t(`landing.features.${key}.title`),
                      }),
                      _jsx('p', {
                        className: 'mt-2 text-sm text-muted-foreground',
                        children: t(`landing.features.${key}.description`),
                      }),
                    ],
                  },
                  key,
                ),
              ),
            }),
          ],
        }),
      }),
      _jsx('section', {
        id: 'how-it-works',
        className: 'px-6 py-20',
        children: _jsxs('div', {
          className: 'mx-auto max-w-4xl',
          children: [
            _jsxs('div', {
              className: 'text-center',
              children: [
                _jsx('h2', {
                  className: 'text-3xl font-bold text-foreground',
                  children: t('landing.howItWorks.title'),
                }),
                _jsx('p', {
                  className: 'mt-3 text-muted-foreground',
                  children: t('landing.howItWorks.subtitle'),
                }),
              ],
            }),
            _jsx('div', {
              className: 'mt-12 grid gap-8 sm:grid-cols-3',
              children: steps.map((step, i) =>
                _jsxs(
                  'div',
                  {
                    className: 'text-center',
                    children: [
                      _jsx('div', {
                        className:
                          'mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#34D399] text-lg font-bold text-white',
                        children: i + 1,
                      }),
                      _jsx('h3', {
                        className: 'mt-4 text-lg font-semibold text-foreground',
                        children: t(`landing.howItWorks.${step}.title`),
                      }),
                      _jsx('p', {
                        className: 'mt-2 text-sm text-muted-foreground',
                        children: t(`landing.howItWorks.${step}.description`),
                      }),
                    ],
                  },
                  step,
                ),
              ),
            }),
          ],
        }),
      }),
      _jsx('footer', {
        className: 'border-t bg-muted/30 px-6 py-10',
        children: _jsxs('div', {
          className:
            'mx-auto flex max-w-5xl flex-col items-center gap-6 sm:flex-row sm:justify-between',
          children: [
            _jsxs('div', {
              children: [
                _jsx('p', {
                  className: 'text-lg font-bold text-foreground',
                  children: t('app.name'),
                }),
                _jsx('p', {
                  className: 'text-sm text-muted-foreground',
                  children: t('landing.footer.description'),
                }),
                _jsx('p', {
                  className: 'mt-1 text-xs text-muted-foreground',
                  children: '\u00A9 2026 SIMAK',
                }),
              ],
            }),
            _jsxs('nav', {
              className: 'flex gap-6 text-sm text-muted-foreground',
              children: [
                _jsx(Link, {
                  to: '/auth/login',
                  className: 'hover:text-foreground',
                  children: t('landing.footer.links.login'),
                }),
                _jsx('a', {
                  href: '#',
                  className: 'hover:text-foreground',
                  children: t('landing.footer.links.about'),
                }),
                _jsx('a', {
                  href: '#',
                  className: 'hover:text-foreground',
                  children: t('landing.footer.links.contact'),
                }),
              ],
            }),
          ],
        }),
      }),
    ],
  });
}
