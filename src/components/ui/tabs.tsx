import type { KeyboardEvent } from 'react';
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
  idPrefix?: string;
  ariaLabel?: string;
}

function Tabs({
  tabs,
  activeTab,
  onTabChange,
  className,
  idPrefix = 'tabs',
  ariaLabel,
}: TabsProps) {
  const focusTab = (index: number) => {
    const tab = tabs[index];
    if (!tab) return;
    onTabChange(tab.id);
    document.getElementById(`${idPrefix}-tab-${tab.id}`)?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
    if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = tabs.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    focusTab(nextIndex);
  };

  return (
    <div className={cn('border-b border-border', className)}>
      <div
        className="flex min-w-max gap-4 overflow-x-auto"
        role="tablist"
        aria-label={ariaLabel}
        aria-orientation="horizontal"
      >
        {tabs.map((tab, index) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`${idPrefix}-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`${idPrefix}-tabpanel-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onTabChange(tab.id)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              data-state={isActive ? 'active' : 'inactive'}
              className="min-h-11 shrink-0 border-b-2 px-1 pb-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=inactive]:border-transparent data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground"
            >
              {tab.label}
              {tab.count !== undefined && (
                <CountBadge count={tab.count} hideWhenZero className="ml-1.5" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { Tabs };
