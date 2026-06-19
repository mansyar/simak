import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { format } from 'date-fns/format';
import { Calendar, User, Clipboard } from 'lucide-react';
import { useI18n } from '../../../routes/__root';
import { Badge } from '@/components/ui/badge';
export function AssignmentDetailHeader({ detail }) {
  const { t } = useI18n();
  return _jsxs('div', {
    className: 'space-y-4',
    children: [
      _jsx('div', {
        className: 'flex items-start gap-2',
        children: _jsx(Badge, { variant: 'outline', children: detail.templateType }),
      }),
      _jsxs('div', {
        children: [
          _jsx('h1', {
            className: 'font-display text-3xl text-foreground',
            children: detail.title,
          }),
          detail.description &&
            _jsx('p', {
              className: 'mt-2 text-sm text-muted-foreground',
              children: detail.description,
            }),
        ],
      }),
      _jsxs('div', {
        className: 'flex flex-wrap gap-4 text-sm',
        children: [
          _jsxs('div', {
            className: 'flex items-center gap-1.5 text-muted-foreground',
            children: [
              _jsx(User, { className: 'h-4 w-4' }),
              _jsx('span', {
                className: 'font-medium text-foreground',
                children: detail.instructorName,
              }),
            ],
          }),
          _jsxs('div', {
            className: 'flex items-center gap-1.5 text-muted-foreground',
            children: [
              _jsx(Clipboard, { className: 'h-4 w-4' }),
              _jsx('span', {
                className: 'font-medium text-foreground',
                children: detail.templateName,
              }),
            ],
          }),
          _jsxs('div', {
            className: 'flex items-center gap-1.5 text-muted-foreground',
            children: [
              _jsx(Calendar, { className: 'h-4 w-4' }),
              _jsx('span', {
                className: 'font-medium text-foreground',
                children: t('studentAssignments.finalDeadline', {
                  date: format(new Date(detail.finalDeadline), 'MMM d, yyyy'),
                }),
              }),
            ],
          }),
        ],
      }),
    ],
  });
}
