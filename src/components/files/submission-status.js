import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { useI18n } from '../../routes/__root';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, RefreshCcw, Clock, User, MessageSquare } from 'lucide-react';
function formatDate(date, locale) {
  if (!date) return '';
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date));
}
const statusConfig = {
  pass: {
    badgeVariant: 'success',
    icon: CheckCircle2,
    iconClass: 'text-green-500',
    labelKey: 'files.review.passed',
  },
  revise: {
    badgeVariant: 'destructive',
    icon: RefreshCcw,
    iconClass: 'text-orange-500',
    labelKey: 'files.review.revise',
  },
};
export function SubmissionStatus({ review }) {
  const { t, locale } = useI18n();
  if (!review) {
    return _jsxs(Card, {
      children: [
        _jsx(CardHeader, {
          children: _jsx(CardTitle, { className: 'text-base', children: t('files.review.title') }),
        }),
        _jsx(CardContent, {
          children: _jsxs('div', {
            className: 'flex items-center gap-3',
            children: [
              _jsx(Clock, { className: 'h-5 w-5 text-muted-foreground' }),
              _jsxs('div', {
                children: [
                  _jsx('p', {
                    className: 'text-sm font-medium text-foreground',
                    children: t('files.review.awaiting'),
                  }),
                  _jsx('p', {
                    className: 'text-xs text-muted-foreground',
                    children: t('files.review.awaitingHint'),
                  }),
                ],
              }),
            ],
          }),
        }),
      ],
    });
  }
  const config = statusConfig[review.decision];
  const Icon = config.icon;
  return _jsxs(Card, {
    className: review.decision === 'pass' ? 'border-l-green-500' : 'border-l-orange-500',
    children: [
      _jsx(CardHeader, {
        children: _jsx(CardTitle, { className: 'text-base', children: t('files.review.title') }),
      }),
      _jsxs(CardContent, {
        className: 'space-y-3',
        children: [
          _jsxs('div', {
            className: 'flex items-center gap-2',
            children: [
              _jsx(Icon, { className: `h-5 w-5 ${config.iconClass}` }),
              _jsx(Badge, { variant: config.badgeVariant, children: t(config.labelKey) }),
            ],
          }),
          review.reviewerName &&
            _jsxs('div', {
              className: 'flex items-center gap-2 text-sm text-muted-foreground',
              children: [
                _jsx(User, { className: 'h-4 w-4' }),
                _jsx('span', { children: review.reviewerName }),
              ],
            }),
          review.comment &&
            _jsxs('div', {
              className: 'flex items-start gap-2 text-sm',
              children: [
                _jsx(MessageSquare, { className: 'mt-0.5 h-4 w-4 text-muted-foreground shrink-0' }),
                _jsx('p', { className: 'text-foreground', children: review.comment }),
              ],
            }),
          review.decision !== 'pass' &&
            review.revisionDeadline &&
            _jsxs('div', {
              className: 'flex items-center gap-2 text-sm text-muted-foreground',
              children: [
                _jsx(Clock, { className: 'h-4 w-4' }),
                _jsx('span', {
                  children: t('files.revisionDeadline', {
                    date: formatDate(review.revisionDeadline, locale),
                  }),
                }),
              ],
            }),
          review.reviewedAt &&
            _jsx('p', {
              className: 'text-xs text-muted-foreground',
              children: t('files.review.reviewedOn', {
                date: formatDate(review.reviewedAt, locale),
              }),
            }),
        ],
      }),
    ],
  });
}
