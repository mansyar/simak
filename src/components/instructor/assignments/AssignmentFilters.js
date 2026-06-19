import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { useI18n } from '../../../routes/__root';
export function AssignmentFilters({ search, onSearchChange }) {
  const { t } = useI18n();
  return _jsx('div', {
    className: 'flex flex-col gap-4 sm:flex-row sm:items-center',
    children: _jsxs('div', {
      className: 'relative flex-1',
      children: [
        _jsx(Search, { className: 'absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground' }),
        _jsx(Input, {
          placeholder: t('instructorAssignments.searchPlaceholder'),
          value: search,
          onChange: (e) => onSearchChange(e.target.value),
          className: 'pl-9',
        }),
      ],
    }),
  });
}
