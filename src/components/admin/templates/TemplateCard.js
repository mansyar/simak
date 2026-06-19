import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Copy, Pencil, Trash } from 'lucide-react';
import { format } from 'date-fns/format';
import { useI18n } from '../../../routes/__root';
export function TemplateCard({ template, onEdit, onDuplicate, onDelete }) {
  const { t } = useI18n();
  return _jsx(Card, {
    children: _jsx(CardContent, {
      className: 'p-6',
      children: _jsxs('div', {
        className: 'flex items-start justify-between',
        children: [
          _jsxs('div', {
            className: 'space-y-2',
            children: [
              _jsxs('div', {
                className: 'flex items-center gap-2',
                children: [
                  _jsx('h3', { className: 'font-semibold text-lg', children: template.name }),
                  _jsx(Badge, { variant: 'secondary', children: template.type }),
                ],
              }),
              _jsx('p', {
                className: 'text-sm text-muted-foreground',
                children: t('adminTemplates.checkpointCount', {
                  count: String(template.checkpointCount),
                }),
              }),
              _jsx('p', {
                className: 'text-xs text-muted-foreground',
                children: template.createdAt
                  ? format(new Date(template.createdAt), 'MMM d, yyyy')
                  : '',
              }),
            ],
          }),
          _jsxs(DropdownMenu, {
            children: [
              _jsx(DropdownMenuTrigger, {
                render: _jsxs(Button, {
                  variant: 'ghost',
                  className: 'h-8 w-8 p-0',
                  children: [
                    _jsx('span', { className: 'sr-only', children: t('common.openMenu') }),
                    _jsx(MoreHorizontal, { className: 'h-4 w-4' }),
                  ],
                }),
              }),
              _jsxs(DropdownMenuContent, {
                align: 'end',
                children: [
                  _jsxs(DropdownMenuItem, {
                    onClick: () => onEdit(template),
                    children: [
                      _jsx(Pencil, { className: 'mr-2 h-4 w-4' }),
                      t('adminTemplates.actions.edit'),
                    ],
                  }),
                  _jsxs(DropdownMenuItem, {
                    onClick: () => onDuplicate(template),
                    children: [
                      _jsx(Copy, { className: 'mr-2 h-4 w-4' }),
                      t('adminTemplates.actions.duplicate'),
                    ],
                  }),
                  _jsxs(DropdownMenuItem, {
                    onClick: () => onDelete(template),
                    className: 'text-destructive focus:text-destructive',
                    children: [
                      _jsx(Trash, { className: 'mr-2 h-4 w-4' }),
                      t('adminTemplates.actions.delete'),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    }),
  });
}
