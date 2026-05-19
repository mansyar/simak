import { createFileRoute } from '@tanstack/react-router';
import { useI18n } from '../../__root';

export const Route = createFileRoute('/_authenticated/_admin/users')({
  component: UsersPage,
});

function UsersPage() {
  const { t } = useI18n();

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">{t('adminUsers.title')}</h1>
    </div>
  );
}
