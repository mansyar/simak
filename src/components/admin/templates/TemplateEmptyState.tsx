import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { FileQuestion } from 'lucide-react';
import { useI18n } from '../../../routes/__root';

interface TemplateEmptyStateProps {
  onCreateNew: () => void;
}

export function TemplateEmptyState({ onCreateNew }: TemplateEmptyStateProps) {
  const { t } = useI18n();

  return (
    <EmptyState
      icon={FileQuestion}
      title={t('adminTemplates.empty')}
      description={t('adminTemplates.createPrompt')}
    >
      <Button onClick={onCreateNew}>{t('adminTemplates.newTemplate')}</Button>
    </EmptyState>
  );
}
