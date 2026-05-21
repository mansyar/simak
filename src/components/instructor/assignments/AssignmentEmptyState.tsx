import { Button } from '@/components/ui/button';
import { ClipboardList } from 'lucide-react';
import { useI18n } from '../../../routes/__root';

interface AssignmentEmptyStateProps {
  onCreateNew: () => void;
}

export function AssignmentEmptyState({ onCreateNew }: AssignmentEmptyStateProps) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center bg-card rounded-lg border border-dashed p-8 shadow-sm">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-4">
        <ClipboardList className="h-6 w-6 text-primary" />
      </div>
      <h3 className="text-lg font-medium mb-1">{t('instructorAssignments.empty')}</h3>
      <p className="text-sm text-muted-foreground mb-4">
        {t('instructorAssignments.createPrompt')}
      </p>
      <Button onClick={onCreateNew}>{t('instructorAssignments.newAssignment')}</Button>
    </div>
  );
}
