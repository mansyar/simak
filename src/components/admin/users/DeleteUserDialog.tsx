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
import { AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '../../../routes/__root';
import { MutationFeedback } from '@/components/ui/mutation-feedback';

interface DeleteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
  userName: string;
}

export function DeleteUserDialog({
  open,
  onOpenChange,
  onConfirm,
  userName,
}: DeleteUserDialogProps) {
  const { t } = useI18n();
  const [error, setError] = useState<string>();
  const [isConfirming, setIsConfirming] = useState(false);

  const handleConfirm = async () => {
    setError(undefined);
    setIsConfirming(true);
    try {
      await onConfirm();
      toast.success(t('adminUsers.deleteSuccess'));
    } catch {
      setError(t('adminUsers.deleteError'));
      return;
    } finally {
      setIsConfirming(false);
    }
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) setError(undefined);
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden="true" />
            {t('adminUsers.deleteTitle')}
          </DialogTitle>
          <DialogDescription>{t('adminUsers.deleteConfirm', { name: userName })}</DialogDescription>
        </DialogHeader>

        <MutationFeedback error={error} />

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={isConfirming}
          >
            {t('common.delete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
