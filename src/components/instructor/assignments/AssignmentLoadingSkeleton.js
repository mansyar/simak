import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
export function AssignmentLoadingSkeleton({ count = 6 }) {
  return _jsx('div', {
    className: 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3',
    children: Array.from({ length: count }).map((_, i) =>
      _jsxs(
        Card,
        {
          className: 'overflow-hidden',
          children: [
            _jsx('div', { className: 'h-1 bg-muted' }),
            _jsxs(CardContent, {
              className: 'p-5 space-y-4',
              children: [
                _jsxs('div', {
                  className: 'space-y-2',
                  children: [
                    _jsx(Skeleton, { 'data-testid': 'skeleton', className: 'h-3 w-1/4 rounded' }),
                    _jsx(Skeleton, { 'data-testid': 'skeleton', className: 'h-5 w-3/4 rounded' }),
                  ],
                }),
                _jsxs('div', {
                  className: 'space-y-1',
                  children: [
                    _jsx(Skeleton, { 'data-testid': 'skeleton', className: 'h-4 w-full rounded' }),
                    _jsx(Skeleton, { 'data-testid': 'skeleton', className: 'h-4 w-5/6 rounded' }),
                  ],
                }),
                _jsxs('div', {
                  className: 'flex items-center justify-between border-t pt-3',
                  children: [
                    _jsxs('div', {
                      className: 'flex gap-4',
                      children: [
                        _jsx(Skeleton, {
                          'data-testid': 'skeleton',
                          className: 'h-3.5 w-16 rounded',
                        }),
                        _jsx(Skeleton, {
                          'data-testid': 'skeleton',
                          className: 'h-3.5 w-24 rounded',
                        }),
                      ],
                    }),
                    _jsx(Skeleton, { 'data-testid': 'skeleton', className: 'h-4 w-12 rounded' }),
                  ],
                }),
              ],
            }),
          ],
        },
        i,
      ),
    ),
  });
}
