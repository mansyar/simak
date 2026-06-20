import type { Badge } from '@/components/ui/badge';
import type { TranslationKey } from '@/i18n/index';

type BadgeVariant = React.ComponentProps<typeof Badge>['variant'];

interface RoleConfig {
  value: string;
  labelKey: TranslationKey;
  badgeVariant: BadgeVariant;
}

const ROLES: ReadonlyArray<RoleConfig> = [
  { value: 'superadmin', labelKey: 'adminUsers.role_superadmin', badgeVariant: 'default' },
  { value: 'admin', labelKey: 'adminUsers.role_admin', badgeVariant: 'warning' },
  { value: 'instructor', labelKey: 'adminUsers.role_instructor', badgeVariant: 'info' },
  { value: 'student', labelKey: 'adminUsers.role_student', badgeVariant: 'secondary' },
] as const;

function getRoleConfig(value: string): RoleConfig | undefined {
  return ROLES.find((role) => role.value === value);
}

export { ROLES, getRoleConfig };
export type { RoleConfig };
