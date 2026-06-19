import { jsxs as _jsxs, jsx as _jsx } from 'react/jsx-runtime';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useI18n } from '../../../routes/__root';
export function TemplatePagination({ currentPage, totalPages, onPageChange }) {
  const { t } = useI18n();
  return _jsxs('div', {
    className: 'flex items-center justify-between py-4',
    children: [
      _jsxs('p', {
        className: 'text-sm text-muted-foreground',
        children: [t('common.page'), ' ', currentPage, ' of ', totalPages],
      }),
      _jsxs('div', {
        className: 'flex items-center gap-2',
        children: [
          _jsxs(Button, {
            variant: 'outline',
            size: 'sm',
            disabled: currentPage <= 1,
            onClick: () => onPageChange(currentPage - 1),
            'aria-label': t('common.previousPage'),
            children: [_jsx(ChevronLeft, { className: 'h-4 w-4 mr-1' }), t('common.back')],
          }),
          _jsxs(Button, {
            variant: 'outline',
            size: 'sm',
            disabled: currentPage >= totalPages,
            onClick: () => onPageChange(currentPage + 1),
            'aria-label': t('common.nextPage'),
            children: [t('common.next'), _jsx(ChevronRight, { className: 'h-4 w-4 ml-1' })],
          }),
        ],
      }),
    ],
  });
}
