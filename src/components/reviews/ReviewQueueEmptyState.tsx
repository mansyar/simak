import { ClipboardCheck } from 'lucide-react';
import { useI18n } from '../../routes/__root';

export function ReviewQueueEmptyState() {
  const { t } = useI18n();

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center bg-card rounded-lg border border-dashed p-8 shadow-sm">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30 mb-4">
        <ClipboardCheck className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
      </div>
      <h3 className="text-lg font-medium mb-1">{t('instructorReviews.empty')}</h3>
      <p className="text-sm text-muted-foreground">{t('instructorReviews.emptyPrompt')}</p>
    </div>
  );
}
