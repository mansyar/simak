import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { useI18n } from '../../routes/__root';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
export function ReviewQueueFilters({ assignments, selectedAssignmentId, onAssignmentChange }) {
  const { t } = useI18n();
  const value = selectedAssignmentId !== null ? String(selectedAssignmentId) : 'all';
  return _jsx('div', {
    className: 'flex flex-col gap-4 sm:flex-row sm:items-center',
    children: _jsx('div', {
      className: 'w-full sm:w-[240px]',
      children: _jsxs(Select, {
        value: value,
        onValueChange: (val) => onAssignmentChange(val === 'all' ? null : Number(val)),
        children: [
          _jsx(SelectTrigger, {
            'data-testid': 'assignment-filter',
            children: _jsx('span', {
              children:
                value === 'all'
                  ? t('instructorReviews.allAssignments')
                  : (assignments.find((a) => a.id === Number(value))?.title ??
                    t('instructorReviews.allAssignments')),
            }),
          }),
          _jsxs(SelectContent, {
            children: [
              _jsx(SelectItem, { value: 'all', children: t('instructorReviews.allAssignments') }),
              assignments.map((a) =>
                _jsx(SelectItem, { value: String(a.id), children: a.title }, a.id),
              ),
            ],
          }),
        ],
      }),
    }),
  });
}
