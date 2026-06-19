import { jsx as _jsx } from 'react/jsx-runtime';
import { cn } from '@/lib/utils';
function CountBadge({ count, hideWhenZero = false, className }) {
  if (hideWhenZero && count === 0) {
    return null;
  }
  return _jsx('span', {
    className: cn(
      'inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold rounded-full bg-primary text-primary-foreground',
      className,
    ),
    children: count,
  });
}
export { CountBadge };
