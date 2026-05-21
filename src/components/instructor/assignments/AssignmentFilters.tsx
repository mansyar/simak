import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { useI18n } from '../../../routes/__root';

interface AssignmentFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
}

export function AssignmentFilters({ search, onSearchChange }: AssignmentFiltersProps) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t('instructorAssignments.searchPlaceholder')}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>
    </div>
  );
}
