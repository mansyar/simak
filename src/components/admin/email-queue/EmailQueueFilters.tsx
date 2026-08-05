import { Input } from '@/components/ui/input';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Search } from 'lucide-react';
import { useI18n } from '../../../routes/__root';

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

  return (
    <div className="flex flex-wrap gap-4">
      <div className="flex-1 min-w-[200px]">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            id="admin-email-queue-search"
            aria-label={t('adminEmailQueue.searchLabel')}
            placeholder={t('adminEmailQueue.searchPlaceholder')}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
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
