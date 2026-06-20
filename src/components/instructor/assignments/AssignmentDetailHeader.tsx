import { PageHeader } from '@/components/ui/page-header';
import { TemplateTypeBadge } from '@/components/ui/template-type-badge';
import { useI18n } from '@/routes/__root';

interface AssignmentDetailHeaderProps {
  title: string;
  templateType: string;
  description: string | null;
}

export function AssignmentDetailHeader({
  title,
  templateType,
  description,
}: AssignmentDetailHeaderProps) {
  const { t } = useI18n();

  return (
    <>
      <PageHeader
        title={title}
        back={{
          to: '/instructor/assignments',
          label: t('common.back'),
          search: { page: 1, limit: 20, search: '' },
        }}
      />

      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <TemplateTypeBadge type={templateType} />
          </div>
          {description && (
            <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">
              {description}
            </p>
          )}
        </div>
      </div>
    </>
  );
}
