import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { useI18n } from '../../routes/__root';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, RefreshCcw, User, MessageSquare, Clock } from 'lucide-react';
export function ReviewHistory({ reviews }) {
  const { t } = useI18n();
  if (reviews.length === 0) return null;
  return _jsxs(Card, {
    className: 'shadow-sm',
    children: [
      _jsx(CardHeader, {
        children: _jsx(CardTitle, {
          className: 'text-sm',
          children: t('instructorReviews.reviewHistory'),
        }),
      }),
      _jsx(CardContent, {
        children: _jsx('div', {
          className: 'space-y-3',
          children: reviews.map((review) =>
            _jsxs(
              'div',
              {
                className: 'flex items-start gap-3 rounded-md border bg-muted/20 p-3',
                children: [
                  _jsx('div', {
                    className: 'mt-0.5',
                    children:
                      review.decision === 'pass'
                        ? _jsx(CheckCircle2, { className: 'h-4 w-4 text-green-500' })
                        : _jsx(RefreshCcw, { className: 'h-4 w-4 text-orange-500' }),
                  }),
                  _jsxs('div', {
                    className: 'flex-1 space-y-1',
                    children: [
                      _jsxs('div', {
                        className: 'flex items-center gap-2',
                        children: [
                          _jsx(Badge, {
                            variant: review.decision === 'pass' ? 'success' : 'warning',
                            children:
                              review.decision === 'pass'
                                ? t('instructorReviews.passed')
                                : t('instructorReviews.revise'),
                          }),
                          _jsxs('span', {
                            className: 'text-xs text-muted-foreground',
                            children: [
                              _jsx(Clock, { className: 'inline h-3 w-3 mr-1' }),
                              new Date(review.createdAt).toLocaleDateString(),
                            ],
                          }),
                        ],
                      }),
                      _jsxs('div', {
                        className: 'flex items-center gap-2 text-xs text-muted-foreground',
                        children: [
                          _jsx(User, { className: 'h-3 w-3' }),
                          _jsx('span', { children: review.instructorName }),
                        ],
                      }),
                      review.comment &&
                        _jsxs('div', {
                          className: 'flex items-start gap-1 text-xs text-foreground',
                          children: [
                            _jsx(MessageSquare, {
                              className: 'mt-0.5 h-3 w-3 shrink-0 text-muted-foreground',
                            }),
                            _jsx('p', { children: review.comment }),
                          ],
                        }),
                    ],
                  }),
                ],
              },
              review.id,
            ),
          ),
        }),
      }),
    ],
  });
}
