import { Button } from '@/components/ui/button';
import { FileQuestion } from 'lucide-react';
import { useI18n } from '../../../routes/__root';

interface TemplateEmptyStateProps {
  onCreateNew: () => void;
}

export function TemplateEmptyState({ onCreateNew }: TemplateEmptyStateProps) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <FileQuestion className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-medium mb-1">{t('adminTemplates.empty')}</h3>
      <p className="text-sm text-muted-foreground mb-4">{t('adminTemplates.createPrompt')}</p>
      <Button onClick={onCreateNew}>{t('adminTemplates.newTemplate')}</Button>
    </div>
  );
}
