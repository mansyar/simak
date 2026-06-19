import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { Search } from 'lucide-react';
import { useI18n } from '../../../routes/__root';
export function TemplateFilters({ search, onSearchChange, type, types, onTypeChange }) {
  const { t } = useI18n();
  return _jsxs('div', {
    className: 'flex flex-col gap-4 sm:flex-row sm:items-center',
    children: [
      _jsxs('div', {
        className: 'relative flex-1',
        children: [
          _jsx(Search, { className: 'absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground' }),
          _jsx(Input, {
            placeholder: t('adminTemplates.searchPlaceholder'),
            value: search,
            onChange: (e) => onSearchChange(e.target.value),
            className: 'pl-9',
          }),
        ],
      }),
      _jsx('div', {
        className: 'w-full sm:w-[180px]',
        children: _jsxs(Select, {
          value: type,
          onValueChange: (val) => onTypeChange(val || 'all'),
          children: [
            _jsx(SelectTrigger, {
              children: _jsx('span', {
                'data-slot': 'select-value',
                className: 'flex flex-1 text-left',
                children: type !== 'all' ? type : t('adminTemplates.filterByType'),
              }),
            }),
            _jsxs(SelectContent, {
              children: [
                _jsx(SelectItem, { value: 'all', children: t('adminTemplates.filterByType') }),
                types.map((t) => _jsx(SelectItem, { value: t, children: t }, t)),
              ],
            }),
          ],
        }),
      }),
    ],
  });
}
