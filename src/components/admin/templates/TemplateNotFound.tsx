import { SearchX } from 'lucide-react';
import { BackLink } from '@/components/ui/back-link';
import { useI18n } from '../../../routes/__root';

export function TemplateNotFound() {
  const { t } = useI18n();

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <SearchX className="h-12 w-12 text-muted-foreground mb-4" />
      <h2 className="text-xl font-semibold mb-2">{t('error.notFound')}</h2>
      <p className="text-muted-foreground mb-4">{t('error.templateNotFound')}</p>
      <BackLink
        to="/admin/templates"
        label={t('adminTemplates.detail.back')}
        search={{ page: 1, limit: 20, search: '', type: '' }}
      />
    </div>
  );
}
