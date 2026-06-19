import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
export function ReviewQueueSkeleton({ count = 5 }) {
  return _jsx(Card, {
    children: _jsx(CardContent, {
      className: 'p-0',
      children: _jsxs(Table, {
        children: [
          _jsx(TableHeader, {
            children: _jsxs(TableRow, {
              children: [
                _jsx(TableHead, {}),
                _jsx(TableHead, {}),
                _jsx(TableHead, {}),
                _jsx(TableHead, {}),
                _jsx(TableHead, {}),
              ],
            }),
          }),
          _jsx(TableBody, {
            children: Array.from({ length: count }).map((_, i) =>
              _jsxs(
                TableRow,
                {
                  children: [
                    _jsx(TableCell, {
                      children: _jsxs('div', {
                        className: 'flex flex-col gap-1.5',
                        children: [
                          _jsx(Skeleton, {
                            'data-testid': 'skeleton',
                            className: 'h-4 w-32 rounded',
                          }),
                          _jsx(Skeleton, {
                            'data-testid': 'skeleton',
                            className: 'h-3 w-24 rounded',
                          }),
                        ],
                      }),
                    }),
                    _jsx(TableCell, {
                      children: _jsx(Skeleton, {
                        'data-testid': 'skeleton',
                        className: 'h-4 w-28 rounded',
                      }),
                    }),
                    _jsx(TableCell, {
                      children: _jsx(Skeleton, {
                        'data-testid': 'skeleton',
                        className: 'h-4 w-16 rounded',
                      }),
                    }),
                    _jsx(TableCell, {
                      children: _jsx(Skeleton, {
                        'data-testid': 'skeleton',
                        className: 'h-5 w-20 rounded-full',
                      }),
                    }),
                    _jsxs(TableCell, {
                      children: [
                        _jsx(Skeleton, { 'data-testid': 'skeleton', className: 'h-4 w-4 rounded' }),
                        _jsx(Skeleton, {
                          'data-testid': 'skeleton',
                          className: 'h-8 w-16 rounded-md',
                        }),
                      ],
                    }),
                  ],
                },
                i,
              ),
            ),
          }),
        ],
      }),
    }),
  });
}
