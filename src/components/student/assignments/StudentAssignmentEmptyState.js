import { jsx as _jsx } from 'react/jsx-runtime';
import { ClipboardList } from 'lucide-react';
import { useI18n } from '../../../routes/__root';
import { EmptyState } from '@/components/ui/empty-state';
export function StudentAssignmentEmptyState() {
  const { t } = useI18n();
  return _jsx(EmptyState, {
    icon: ClipboardList,
    title: t('studentAssignments.empty'),
    description: t('studentAssignments.emptyPrompt'),
  });
}
