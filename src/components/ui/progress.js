import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { cn } from '@/lib/utils';
function Progress({ className, value = 0, max = 100, label, showValue = false, ...props }) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
  return _jsxs('div', {
    role: 'progressbar',
    'aria-valuenow': value,
    'aria-valuemax': max,
    'aria-valuemin': 0,
    className: cn('w-full', className),
    ...props,
    children: [
      (label || showValue) &&
        _jsxs('div', {
          className: 'mb-1.5 flex items-center justify-between text-xs',
          children: [
            label && _jsx('span', { className: 'text-muted-foreground', children: label }),
            showValue &&
              _jsxs('span', {
                className: 'font-semibold text-foreground',
                children: [Math.round(percentage), '%'],
              }),
          ],
        }),
      _jsx('div', {
        className: 'h-2 w-full overflow-hidden rounded-full bg-muted',
        children: _jsx('div', {
          className: 'h-full rounded-full bg-primary transition-all duration-500',
          style: { width: `${percentage}%` },
        }),
      }),
    ],
  });
}
export { Progress };
