import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { BackLink } from '@/components/ui/back-link';
import { cn } from '@/lib/utils';
function PageHeader({ title, subtitle, action, back, className }) {
  return _jsxs('div', {
    className: cn('space-y-2', className),
    children: [
      back && _jsx(BackLink, { to: back.to, label: back.label, search: back.search }),
      _jsxs('div', {
        className: 'flex items-start justify-between gap-4',
        children: [
          _jsxs('div', {
            children: [
              _jsx('h1', { className: 'font-display text-3xl text-foreground', children: title }),
              subtitle &&
                _jsx('p', { className: 'text-sm text-muted-foreground mt-1', children: subtitle }),
            ],
          }),
          action && _jsx('div', { className: 'flex-shrink-0', children: action }),
        ],
      }),
    ],
  });
}
export { PageHeader };
