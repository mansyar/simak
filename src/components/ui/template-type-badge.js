import { jsx as _jsx } from 'react/jsx-runtime';
import { cn } from '@/lib/utils';
function TemplateTypeBadge({ type, className }) {
  return _jsx('span', {
    className: cn(
      'text-[10px] font-bold tracking-wider uppercase text-primary bg-primary/10 px-2 py-0.5 rounded-full',
      className,
    ),
    children: type,
  });
}
export { TemplateTypeBadge };
