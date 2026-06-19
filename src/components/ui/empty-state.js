import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { cn } from '@/lib/utils';
export function EmptyState({
  icon: Icon,
  title,
  description,
  children,
  className,
  compact = false,
}) {
  return _jsxs('div', {
    className: cn(
      'flex flex-col items-center justify-center rounded-lg border border-dashed bg-card text-center shadow-sm',
      compact ? 'p-4 py-6' : 'p-8 py-12',
      className,
    ),
    children: [
      _jsx('div', {
        className: cn(
          'mb-5 flex items-center justify-center rounded-full border border-dashed',
          compact ? 'size-12' : 'size-16',
        ),
        children: _jsx(Icon, {
          className: cn('text-muted-foreground', compact ? 'size-5' : 'size-7'),
        }),
      }),
      _jsx('h3', { className: 'text-[0.9375rem] font-semibold text-foreground', children: title }),
      description &&
        _jsx('p', {
          className: 'mt-1 text-[0.8125rem] text-muted-foreground',
          children: description,
        }),
      children && _jsx('div', { className: 'mt-4', children: children }),
    ],
  });
}
