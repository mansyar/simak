import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { useI18n } from '../../routes/__root';
export function LanguageSwitcher({ currentLocale, onSwitch }) {
  const { t } = useI18n();
  return _jsxs('div', {
    className: 'inline-flex items-center gap-1 rounded-md border border-border p-1',
    children: [
      _jsx('button', {
        type: 'button',
        onClick: () => onSwitch('en'),
        className: `rounded px-2 py-1 min-h-11 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          currentLocale === 'en'
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
        }`,
        'aria-label': t('language.switchToEnglish'),
        children: 'EN',
      }),
      _jsx('button', {
        type: 'button',
        onClick: () => onSwitch('id'),
        className: `rounded px-2 py-1 min-h-11 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          currentLocale === 'id'
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
        }`,
        'aria-label': t('language.switchToIndonesian'),
        children: 'ID',
      }),
    ],
  });
}
