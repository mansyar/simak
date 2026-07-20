import { useI18n } from '../../routes/__root';
import type { TranslationKey } from '../../i18n/index';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/format-date';

interface ConsultationItem {
  id: number;
  checkpointName: string;
  sessionType: string | null;
  externalConsultantName: string | null;
  notes: string | null;
  status: string;
  createdAt: string;
}

interface ConsultationListProps {
  consultations: ConsultationItem[];
}

function getStatusBadgeVariant(status: string): 'warning' | 'success' | 'destructive' | 'outline' {
  switch (status) {
    case 'pending':
      return 'warning';
    case 'verified':
      return 'success';
    case 'rejected':
      return 'destructive';
    default:
      return 'outline';
  }
}

export function ConsultationList({ consultations }: ConsultationListProps) {
  const { t, locale } = useI18n();

  if (consultations.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>{t('consultations.noConsultations')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {consultations.map((item) => (
        <div key={item.id} className="rounded-lg border bg-card p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-medium text-sm text-foreground">{item.checkpointName}</span>
            <Badge variant={getStatusBadgeVariant(item.status)}>
              {t(`consultations.status.${item.status}` as TranslationKey)}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2">{item.notes ?? '-'}</p>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {item.sessionType === 'external' && item.externalConsultantName
                ? `${t('consultations.external')}: ${item.externalConsultantName}`
                : t('consultations.internal')}
            </span>
            <span>{formatDate(item.createdAt, locale, 'short')}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
