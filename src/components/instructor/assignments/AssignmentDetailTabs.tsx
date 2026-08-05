import { Tabs } from '@/components/ui/tabs';

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

export function AssignmentDetailTabs({ tabs, activeTab, onTabChange }: AssignmentDetailTabsProps) {
  return (
    <Tabs
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={onTabChange}
      idPrefix="assignment-detail"
    />
  );
}
