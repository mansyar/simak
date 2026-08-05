import { TemplateTypeBadge } from '@/components/ui/template-type-badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Copy, Pencil, Trash } from 'lucide-react';
import { formatDate } from '@/lib/format-date';
import { useI18n } from '../../../routes/__root';

export type TemplateRow = {
  id: number;
  name: string;
  type: string;
  checkpointCount: number;
  createdAt: Date | null;
};

interface TemplateCardProps {
  template: TemplateRow;
  onEdit: (template: TemplateRow) => void;
  onDuplicate: (template: TemplateRow) => void;
  onDelete: (template: TemplateRow) => void;
}

export function TemplateCard({ template, onEdit, onDuplicate, onDelete }: TemplateCardProps) {
  const { t, locale } = useI18n();

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-lg">{template.name}</h2>
              <TemplateTypeBadge type={template.type} />
            </div>
            <p className="text-sm text-muted-foreground">
              {t('adminTemplates.checkpointCount', { count: String(template.checkpointCount) })}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatDate(template.createdAt, locale, 'short')}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <span className="sr-only">{t('common.openMenu')}</span>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(template)}>
                <Pencil className="mr-2 h-4 w-4" />
                {t('adminTemplates.actions.edit')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDuplicate(template)}>
                <Copy className="mr-2 h-4 w-4" />
                {t('adminTemplates.actions.duplicate')}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete(template)}
                className="text-destructive focus:text-destructive"
              >
                <Trash className="mr-2 h-4 w-4" />
                {t('adminTemplates.actions.delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}
