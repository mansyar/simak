import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { SearchX } from 'lucide-react';
import { useI18n } from '../../../routes/__root';
export function TemplateNotFound() {
  const { t } = useI18n();
  return _jsxs('div', {
    className: 'flex flex-col items-center justify-center py-12 text-center',
    children: [
      _jsx(SearchX, { className: 'h-12 w-12 text-muted-foreground mb-4' }),
      _jsx('h2', { className: 'text-xl font-semibold mb-2', children: t('error.notFound') }),
      _jsx('p', { className: 'text-muted-foreground mb-4', children: t('error.templateNotFound') }),
      _jsx(Link, {
        to: '/admin/templates',
        search: { page: 1, limit: 20, search: '', type: '' },
        children: _jsx(Button, { variant: 'outline', children: t('adminTemplates.detail.back') }),
      }),
    ],
  });
}
