import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search } from 'lucide-react';
import { useI18n } from '../../../routes/__root';

interface UserFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  role: string;
  onRoleChange: (value: string) => void;
}

const roleLabels: Record<string, string> = {
  all: 'adminUsers.allRoles',
  superadmin: 'adminUsers.role_superadmin',
  admin: 'adminUsers.role_admin',
  instructor: 'adminUsers.role_instructor',
  student: 'adminUsers.role_student',
};

export function UserFilters({
  search,
  onSearchChange,
  role,
  onRoleChange,
}: UserFiltersProps) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t('adminUsers.searchPlaceholder')}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>
      <div className="w-full sm:w-[180px]">
        <Select value={role} onValueChange={(val) => onRoleChange(val || 'all')}>
          <SelectTrigger>
            <span data-slot="select-value" className="flex flex-1 text-left">
              {role && role !== 'all' ? t(roleLabels[role] || role) : t('adminUsers.allRoles')}
            </span>
          </SelectTrigger>
          <SelectContent>
            {Object.entries(roleLabels).map(([value, labelKey]) => (
              <SelectItem key={value} value={value}>
                {t(labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
