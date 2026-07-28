import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { DeleteTemplateDialog } from './DeleteTemplateDialog';
import { useI18n } from '../../../routes/__root';

interface TemplateDangerZoneProps {
  assignmentCount: number;
  onDelete: () => void;
}

export function TemplateDangerZone({ assignmentCount, onDelete }: TemplateDangerZoneProps) {
  const { t } = useI18n();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  return (
    <>
      <Card className="border-destructive/20">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium text-foreground">
                {t('adminTemplates.actions.delete')}
              </h2>
              <p className="text-xs text-muted-foreground">{t('adminTemplates.deleteConfirm')}</p>
            </div>
            <Button
              variant="destructive"
              onClick={() => setIsDeleteOpen(true)}
              data-testid="delete-template"
            >
              <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
              {t('adminTemplates.actions.delete')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <DeleteTemplateDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        onConfirm={onDelete}
        usageCount={assignmentCount}
      />
    </>
  );
}
