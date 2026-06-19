import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { Sun, Moon, Paintbrush } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useI18n } from '@/routes/__root';
import { useTheme } from '@/hooks/use-theme';
export function AppearanceSection() {
  const { t, locale, setLocale } = useI18n();
  const { theme, toggleTheme } = useTheme();
  return _jsxs(Card, {
    children: [
      _jsxs(CardHeader, {
        children: [
          _jsxs(CardTitle, {
            className: 'flex items-center gap-2',
            children: [_jsx(Paintbrush, { className: 'h-5 w-5' }), t('settings.appearance.title')],
          }),
          _jsx(CardDescription, { children: t('settings.appearance.description') }),
        ],
      }),
      _jsxs(CardContent, {
        className: 'space-y-6',
        children: [
          _jsxs('div', {
            className: 'space-y-2',
            children: [
              _jsx(Label, { children: t('settings.appearance.languageLabel') }),
              _jsxs('div', {
                className: 'inline-flex items-center gap-1 rounded-md border border-border p-1',
                children: [
                  _jsx('button', {
                    type: 'button',
                    onClick: () => setLocale('en'),
                    className: `rounded px-2 py-1 min-h-11 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      locale === 'en'
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    }`,
                    children: 'EN',
                  }),
                  _jsx('button', {
                    type: 'button',
                    onClick: () => setLocale('id'),
                    className: `rounded px-2 py-1 min-h-11 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      locale === 'id'
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    }`,
                    children: 'ID',
                  }),
                ],
              }),
            ],
          }),
          _jsxs('div', {
            className: 'space-y-2',
            children: [
              _jsx(Label, { children: t('settings.appearance.themeLabel') }),
              _jsx('button', {
                type: 'button',
                onClick: toggleTheme,
                className:
                  'inline-flex items-center justify-center rounded-md p-2 min-h-11 min-w-11 text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                'aria-label': t('theme.toggle'),
                children: theme === 'light' ? _jsx(Sun, { size: 20 }) : _jsx(Moon, { size: 20 }),
              }),
            ],
          }),
        ],
      }),
    ],
  });
}
