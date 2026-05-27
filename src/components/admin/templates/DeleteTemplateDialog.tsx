import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertTriangle } from 'lucide-react';
import { useI18n } from '../../../routes/__root';

interface DeleteTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  usageCount: number;
}

export function DeleteTemplateDialog({
  open,
  onOpenChange,
  onConfirm,
  usageCount,
}: DeleteTemplateDialogProps) {
  const { t } = useI18n();
  const [deleteText, setDeleteText] = useState('');

  const isInUse = usageCount > 0;
  const canConfirm = !isInUse || deleteText === 'DELETE';

  const handleConfirm = () => {
    if (canConfirm) {
      onConfirm();
      setDeleteText('');
      onOpenChange(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setDeleteText('');
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isInUse && <AlertTriangle className="h-5 w-5 text-destructive" />}
            {t('adminTemplates.deleteConfirm')}
          </DialogTitle>
          <DialogDescription>
            {isInUse ? (
              <span className="text-destructive">
                {t('adminTemplates.deleteInUse', { count: String(usageCount) })}
              </span>
            ) : (
              t('adminTemplates.deleteConfirm')
            )}
          </DialogDescription>
        </DialogHeader>

        {isInUse && (
          <div className="py-2">
            <Input
              value={deleteText}
              onChange={(e) => setDeleteText(e.target.value)}
              placeholder={t('common.typeDeleteToConfirm')}
              data-testid="delete-input"
            />
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={!canConfirm}
          >
            {t('adminTemplates.actions.delete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
