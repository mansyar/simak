import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
function BackLink({ to, label, search, className }) {
  return _jsxs(Link, {
    to: to,
    search: search,
    className: cn(
      'inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary transition-colors',
      className,
    ),
    children: [_jsx(ArrowLeft, { className: 'h-4 w-4' }), label],
  });
}
export { BackLink };
