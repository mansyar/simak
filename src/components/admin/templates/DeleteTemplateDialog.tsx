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
import { Label } from '@/components/ui/label';
import { AlertTriangle } from 'lucide-react';
import { useI18n } from '../../../routes/__root';
import { MutationFeedback } from '@/components/ui/mutation-feedback';

interface DeleteTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
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
  const [error, setError] = useState<string>();
  const [isConfirming, setIsConfirming] = useState(false);

  const isInUse = usageCount > 0;
  const canConfirm = !isInUse || deleteText === t('common.deleteConfirmationWord');

  const handleConfirm = async () => {
    if (!canConfirm) return;

    setError(undefined);
    setIsConfirming(true);
    try {
      await onConfirm();
      setDeleteText('');
      onOpenChange(false);
    } catch {
      setError(t('adminTemplates.deleteError'));
    } finally {
      setIsConfirming(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setDeleteText('');
      setError(undefined);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isInUse && <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden="true" />}
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

        <MutationFeedback error={error} />

        {isInUse && (
          <div className="py-2 space-y-2">
            <Label htmlFor="delete-confirm-input">{t('common.typeDeleteToConfirm')}</Label>
            <Input
              id="delete-confirm-input"
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
            disabled={!canConfirm || isConfirming}
          >
            {t('adminTemplates.actions.delete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
