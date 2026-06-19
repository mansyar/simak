import { jsx as _jsx } from 'react/jsx-runtime';
import { Button } from '@/components/ui/button';
import { ClipboardList } from 'lucide-react';
import { useI18n } from '../../../routes/__root';
import { EmptyState } from '@/components/ui/empty-state';
export function AssignmentEmptyState({ onCreateNew }) {
  const { t } = useI18n();
  return _jsx(EmptyState, {
    icon: ClipboardList,
    title: t('instructorAssignments.empty'),
    description: t('instructorAssignments.createPrompt'),
    children: _jsx(Button, {
      onClick: onCreateNew,
      children: t('instructorAssignments.newAssignment'),
    }),
  });
}
