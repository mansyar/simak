import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { Card, CardContent } from '@/components/ui/card';
export function TemplateLoadingSkeleton({ count = 6 }) {
  return _jsx('div', {
    className: 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3',
    children: Array.from({ length: count }).map((_, i) =>
      _jsx(
        Card,
        {
          children: _jsx(CardContent, {
            className: 'p-6',
            children: _jsxs('div', {
              className: 'space-y-3',
              children: [
                _jsx('div', {
                  'data-testid': 'skeleton',
                  className: 'h-5 w-3/4 rounded bg-muted animate-pulse',
                }),
                _jsx('div', {
                  'data-testid': 'skeleton',
                  className: 'h-4 w-1/2 rounded bg-muted animate-pulse',
                }),
                _jsx('div', {
                  'data-testid': 'skeleton',
                  className: 'h-3 w-1/3 rounded bg-muted animate-pulse',
                }),
              ],
            }),
          }),
        },
        i,
      ),
    ),
  });
}
