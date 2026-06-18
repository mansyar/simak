import { useI18n } from '../../../routes/__root';

interface ExtensionHistoryItem {
  id: number;
  category: string;
  extensionDays: number;
  status: 'pending' | 'approved' | 'rejected';
  reason: string | null;
  createdAt: string;
  resolvedAt: string | null;
  resolutionReason: string | null;
  checkpointName: string | null;
}

interface ExtensionHistoryListProps {
  items: ExtensionHistoryItem[];
}

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'pending':
      return 'text-yellow-700 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/30';
    case 'approved':
      return 'text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/30';
    case 'rejected':
      return 'text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-900/30';
    default:
      return 'text-muted-foreground bg-muted';
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

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function ExtensionHistoryList({ items }: ExtensionHistoryListProps) {
  const { t } = useI18n();

  if (items.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-5 shadow-sm">
        <p className="text-sm text-muted-foreground">{t('extensions.noHistory')}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-5 shadow-sm">
      <h3 className="text-lg font-semibold text-foreground mb-4">{t('extensions.historyTitle')}</h3>
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
                <td className="py-3 pr-4 text-foreground">{formatDate(item.createdAt)}</td>
                <td className="py-3 pr-4 text-foreground">
                  {t(getCategoryLabel(item.category) as unknown as string)}
                </td>
                <td className="py-3 pr-4 text-foreground">{item.extensionDays} days</td>
                <td className="py-3 pr-4">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(item.status)}`}
                  >
                    {t(
                      `extensions.status${item.status.charAt(0).toUpperCase() + item.status.slice(1)}` as unknown as string,
                    )}
                  </span>
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
