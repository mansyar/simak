import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { Search } from 'lucide-react';
import { useI18n } from '../../../routes/__root';

interface TemplateFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  type: string;
  types: string[];
  onTypeChange: (value: string) => void;
}

export function TemplateFilters({
  search,
  onSearchChange,
  type,
  types,
  onTypeChange,
}: TemplateFiltersProps) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t('adminTemplates.searchPlaceholder')}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>
      <div className="w-full sm:w-[180px]">
        <Select value={type} onValueChange={(val) => onTypeChange(val || 'all')}>
          <SelectTrigger>
            <span data-slot="select-value" className="flex flex-1 text-left">
              {type !== 'all' ? type : t('adminTemplates.filterByType')}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('adminTemplates.filterByType')}</SelectItem>
            {types.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
