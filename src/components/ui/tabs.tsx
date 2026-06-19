import { cn } from '@/lib/utils';
import { CountBadge } from '@/components/ui/count-badge';

interface Tab {
  id: string;
  label: string;
  count?: number;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  className?: string;
}

function Tabs({ tabs, activeTab, onTabChange, className }: TabsProps) {
  return (
    <div className={cn('border-b border-border', className)}>
      <div className="flex gap-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            data-state={activeTab === tab.id ? 'active' : 'inactive'}
            className="pb-2 text-sm font-medium border-b-2 transition-colors data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=inactive]:border-transparent data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground"
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

export { Tabs };
