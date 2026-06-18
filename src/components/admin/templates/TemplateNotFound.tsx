import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { SearchX } from 'lucide-react';
import { useI18n } from '../../../routes/__root';

export function TemplateNotFound() {
  const { t } = useI18n();

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <SearchX className="h-12 w-12 text-muted-foreground mb-4" />
      <h2 className="text-xl font-semibold mb-2">{t('error.notFound')}</h2>
      <p className="text-muted-foreground mb-4">
        {t('error.templateNotFound')}
      </p>
      <Link to="/admin/templates" search={{ page: 1, limit: 20, search: '', type: '' }}>
        <Button variant="outline">{t('adminTemplates.detail.back')}</Button>
      </Link>
    </div>
  );
}
