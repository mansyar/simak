import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Search, X } from 'lucide-react';
import { useI18n } from '../../../routes/__root';
import { useDebouncedCallback } from '@/hooks/use-debounced-callback';

interface EmailQueueFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
}

export function EmailQueueFilters({
  search,
  onSearchChange,
  status,
  onStatusChange,
}: EmailQueueFiltersProps) {
  const { t } = useI18n();
  const [localSearch, setLocalSearch] = useState(search);
  const debouncedSearchChange = useDebouncedCallback(onSearchChange, 300);

  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  return (
    <div className="flex flex-wrap gap-4">
      <div className="flex-1 min-w-[200px]">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            id="admin-email-queue-search"
            aria-label={t('adminEmailQueue.searchLabel')}
            placeholder={t('adminEmailQueue.searchPlaceholder')}
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
      <Select value={status} onValueChange={(value) => onStatusChange(value ?? 'all')}>
        <SelectTrigger
          aria-label={t('adminEmailQueue.statusFilterLabel')}
          className="min-h-11 w-[180px]"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('adminEmailQueue.statusAll')}</SelectItem>
          <SelectItem value="pending">{t('adminEmailQueue.statusPending')}</SelectItem>
          <SelectItem value="processing">{t('adminEmailQueue.statusProcessing')}</SelectItem>
          <SelectItem value="sent">{t('adminEmailQueue.statusSent')}</SelectItem>
          <SelectItem value="failed">{t('adminEmailQueue.statusFailed')}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
