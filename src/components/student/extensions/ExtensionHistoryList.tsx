import { useI18n } from '../../../routes/__root';
import type { TranslationKey } from '../../../i18n/index';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/format-date';

interface ExtensionHistoryItem {
  id: number;
  category: string;
  extensionDays: number;
  status: 'pending' | 'approved' | 'rejected';
  reason: string | null;
  createdAt: Date | null;
  resolvedAt: Date | null;
  resolutionReason: string | null;
  checkpointName: string | null;
}

interface ExtensionHistoryListProps {
  items: ExtensionHistoryItem[];
}

function getStatusBadgeVariant(status: string): 'warning' | 'success' | 'destructive' | 'outline' {
  switch (status) {
    case 'pending':
      return 'warning';
    case 'approved':
      return 'success';
    case 'rejected':
      return 'destructive';
    default:
      return 'outline';
  }
}

function getCategoryLabel(category: string): string {
  const map: Record<string, string> = {
    personal: 'extensions.categoryPersonal',
    research: 'extensions.categoryResearch',
    health: 'extensions.categoryHealth',
    other: 'extensions.categoryOther',
  };
  return map[category] || category;
}

export function ExtensionHistoryList({ items }: ExtensionHistoryListProps) {
  const { t, locale } = useI18n();

  if (items.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-5 shadow-sm">
        <p className="text-sm text-muted-foreground">{t('extensions.noHistory')}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-foreground mb-4">{t('extensions.historyTitle')}</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left pb-2 font-medium text-muted-foreground">
                {t('extensions.tableDate')}
              </th>
              <th className="text-left pb-2 font-medium text-muted-foreground">
                {t('extensions.tableCategory')}
              </th>
              <th className="text-left pb-2 font-medium text-muted-foreground">
                {t('extensions.tableDuration')}
              </th>
              <th className="text-left pb-2 font-medium text-muted-foreground">
                {t('extensions.tableStatus')}
              </th>
              <th className="text-left pb-2 font-medium text-muted-foreground">
                {t('extensions.tableResolution')}
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-border last:border-b-0">
                <td className="py-3 pr-4 text-foreground">
                  {formatDate(item.createdAt, locale, 'short')}
                </td>
                <td className="py-3 pr-4 text-foreground">
                  {t(getCategoryLabel(item.category) as TranslationKey)}
                </td>
                <td className="py-3 pr-4 text-foreground">
                  {t('extensions.daysCount', { count: String(item.extensionDays) })}
                </td>
                <td className="py-3 pr-4">
                  <Badge variant={getStatusBadgeVariant(item.status)}>
                    {t(
                      `extensions.status${item.status.charAt(0).toUpperCase() + item.status.slice(1)}` as TranslationKey,
                    )}
                  </Badge>
                </td>
                <td className="py-3 text-foreground">{item.resolutionReason ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
