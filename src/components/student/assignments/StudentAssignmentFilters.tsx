import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Search, X } from 'lucide-react';
import { useI18n } from '../../../routes/__root';
import { useDebouncedCallback } from '@/hooks/use-debounced-callback';

interface StudentAssignmentFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
}

export function StudentAssignmentFilters({
  search,
  onSearchChange,
}: StudentAssignmentFiltersProps) {
  const { t } = useI18n();
  const [localSearch, setLocalSearch] = useState(search);
  const debouncedSearchChange = useDebouncedCallback(onSearchChange, 300);

  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t('studentAssignments.searchPlaceholder')}
          value={localSearch}
          onChange={(e) => {
            setLocalSearch(e.target.value);
            debouncedSearchChange(e.target.value);
          }}
          className="pl-9"
        />
        {localSearch !== '' && (
          <button
            type="button"
            onClick={() => {
              debouncedSearchChange.cancel();
              setLocalSearch('');
              onSearchChange('');
            }}
            className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
            aria-label={t('common.clearSearch')}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
