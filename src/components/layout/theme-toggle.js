import { jsx as _jsx } from 'react/jsx-runtime';
import { Sun, Moon } from 'lucide-react';
import { useI18n } from '../../routes/__root';
export function ThemeToggle({ theme, onToggle }) {
  const { t } = useI18n();
  return _jsx('button', {
    type: 'button',
    onClick: onToggle,
    className:
      'inline-flex items-center justify-center rounded-md p-2 min-h-11 min-w-11 text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    'aria-label': theme === 'light' ? t('theme.dark') : t('theme.light'),
    children: theme === 'light' ? _jsx(Sun, { size: 20 }) : _jsx(Moon, { size: 20 }),
  });
}
