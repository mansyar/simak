import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Search, X } from 'lucide-react';
import { useI18n } from '../../../routes/__root';
import { useDebouncedCallback } from '@/hooks/use-debounced-callback';

interface AssignmentFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
}

export function AssignmentFilters({ search, onSearchChange }: AssignmentFiltersProps) {
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
        <label htmlFor="instructor-assignment-search" className="sr-only">
          {t('instructorAssignments.searchLabel')}
        </label>
        <Input
          id="instructor-assignment-search"
          placeholder={t('instructorAssignments.searchPlaceholder')}
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
            className="absolute right-1 top-1/2 inline-flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label={t('common.clearSearch')}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
