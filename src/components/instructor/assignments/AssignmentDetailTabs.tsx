import { CountBadge } from '@/components/ui/count-badge';
import { useI18n } from '../../../routes/__root';

interface Tab {
  id: string;
  label: string;
  count?: number;
}

interface AssignmentDetailTabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export function AssignmentDetailTabs({
  tabs,
  activeTab,
  onTabChange,
}: AssignmentDetailTabsProps) {
  const { t } = useI18n();

  return (
    <div className="border-b border-border">
      <div className="flex gap-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <CountBadge count={tab.count} hideWhenZero className="ml-1.5" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
