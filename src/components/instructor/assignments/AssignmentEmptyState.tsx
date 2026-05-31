import { Button } from '@/components/ui/button';
import { ClipboardList } from 'lucide-react';
import { useI18n } from '../../../routes/__root';
import { EmptyState } from '@/components/ui/empty-state';

interface AssignmentEmptyStateProps {
  onCreateNew: () => void;
}

export function AssignmentEmptyState({ onCreateNew }: AssignmentEmptyStateProps) {
  const { t } = useI18n();

  return (
    <EmptyState
      icon={ClipboardList}
      title={t('instructorAssignments.empty')}
      description={t('instructorAssignments.createPrompt')}
    >
      <Button onClick={onCreateNew}>{t('instructorAssignments.newAssignment')}</Button>
    </EmptyState>
  );
}
