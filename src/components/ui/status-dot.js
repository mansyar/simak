import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { cn } from '@/lib/utils';
const variantStyles = {
  verified: {
    dot: 'bg-success',
  },
  inactive: {
    dot: 'bg-muted-foreground/40',
  },
};
export function StatusDot({ variant, label, className }) {
  const styles = variantStyles[variant];
  return _jsxs('span', {
    className: cn('inline-flex items-center gap-1.5', className),
    children: [
      _jsx('span', { className: cn('inline-block size-2 rounded-full', styles.dot) }),
      label && _jsx('span', { className: 'text-sm text-foreground', children: label }),
    ],
  });
}
