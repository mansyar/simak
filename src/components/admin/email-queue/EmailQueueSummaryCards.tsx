import { Card, CardContent } from '@/components/ui/card';
import { useI18n } from '../../../routes/__root';
import type { EmailQueueSummary } from '@/server/email-queue';

interface EmailQueueSummaryCardsProps {
  summary: EmailQueueSummary;
}

export function EmailQueueSummaryCards({ summary }: EmailQueueSummaryCardsProps) {
  const { t } = useI18n();

  return (
    <div className="grid grid-cols-3 gap-4">
      <Card>
        <CardContent className="p-4">
          <div className="text-2xl font-bold">{summary.pending}</div>
          <div className="text-sm text-muted-foreground">
            {t('adminEmailQueue.summary.pending')}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="text-2xl font-bold">{summary.sent}</div>
          <div className="text-sm text-muted-foreground">{t('adminEmailQueue.summary.sent')}</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="text-2xl font-bold">{summary.failed}</div>
          <div className="text-sm text-muted-foreground">{t('adminEmailQueue.summary.failed')}</div>
        </CardContent>
      </Card>
    </div>
  );
}
