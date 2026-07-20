import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, X } from 'lucide-react';
import { useI18n } from '../../../routes/__root';
import { ROLES } from '@/lib/admin/roles';
import { useDebouncedCallback } from '@/hooks/use-debounced-callback';

interface UserFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  role: string;
  onRoleChange: (value: string) => void;
}

export function UserFilters({ search, onSearchChange, role, onRoleChange }: UserFiltersProps) {
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
          placeholder={t('adminUsers.searchPlaceholder')}
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
      <div className="w-full sm:w-[180px]">
        <Select value={role} onValueChange={(val) => onRoleChange(val || 'all')}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('adminUsers.allRoles')}</SelectItem>
            {ROLES.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {t(r.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
