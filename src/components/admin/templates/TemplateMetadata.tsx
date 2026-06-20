import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle } from 'lucide-react';
import { AlertBanner } from '@/components/ui/alert-banner';
import { formatDate } from '@/lib/format-date';
import { useI18n } from '../../../routes/__root';

interface TemplateMetadataProps {
  template: {
    name: string;
    type: string;
    createdAt: Date | null;
    createdBy: string | null;
    createdByName: string | null;
    assignmentCount: number;
  };
  name: string;
  onNameChange: (name: string) => void;
  type: string;
  onTypeChange: (type: string) => void;
}

export function TemplateMetadata({
  template,
  name,
  onNameChange,
  type,
  onTypeChange,
}: TemplateMetadataProps) {
  const { t, locale } = useI18n();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('adminTemplates.detail.metadata')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">
              {t('adminTemplates.form.name')}
            </Label>
            <Input
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder={t('adminTemplates.form.namePlaceholder')}
              data-testid="template-name"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">
              {t('adminTemplates.form.type')}
            </Label>
            <Input
              value={type}
              onChange={(e) => onTypeChange(e.target.value)}
              placeholder={t('adminTemplates.form.typePlaceholder')}
              data-testid="template-type"
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 text-sm text-muted-foreground">
          <div>
            <span className="font-medium">{t('adminTemplates.detail.created')}:</span>{' '}
            {formatDate(template.createdAt ?? new Date(), locale, 'time')}
          </div>
          <div>
            <span className="font-medium">{t('adminTemplates.detail.createdBy')}:</span>{' '}
            {template.createdByName ?? template.createdBy}
          </div>
        </div>

        {template.assignmentCount > 0 && (
          <AlertBanner
            variant="warning"
            title={t('adminTemplates.inUseBanner', { count: String(template.assignmentCount) })}
          />
        )}
      </CardContent>
    </Card>
  );
}
