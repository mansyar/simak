import { SearchX } from 'lucide-react';
import { BackLink } from '@/components/ui/back-link';
import { EmptyState } from '@/components/ui/empty-state';
import { useI18n } from '../../../routes/__root';

export function TemplateNotFound() {
  const { t } = useI18n();

  return (
    <EmptyState
      icon={SearchX}
      title={t('error.notFound')}
      description={t('error.templateNotFound')}
    >
      <BackLink
        to="/admin/templates"
        label={t('adminTemplates.detail.back')}
        search={{ page: 1, limit: 20, search: '', type: '' }}
      />
    </EmptyState>
  );
}
