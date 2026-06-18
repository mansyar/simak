import { useI18n } from '../../routes/__root';
import type { TranslationKey } from '../../i18n/index';

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

const statusBadgeColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  verified: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

export function ConsultationList({ consultations }: ConsultationListProps) {
  const { t } = useI18n();

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
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadgeColors[item.status] ?? 'bg-gray-100 text-gray-800'}`}
            >
              {t(`consultations.status.${item.status}` as TranslationKey)}
            </span>
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2">{item.notes ?? '-'}</p>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {item.sessionType === 'external' && item.externalConsultantName
                ? `${t('consultations.external')}: ${item.externalConsultantName}`
                : t('consultations.internal')}
            </span>
            <span>{new Date(item.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
