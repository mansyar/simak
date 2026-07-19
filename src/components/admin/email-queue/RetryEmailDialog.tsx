import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useI18n } from '../../../routes/__root';

interface RetryEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isRetrying: boolean;
}

export function RetryEmailDialog({
  open,
  onOpenChange,
  onConfirm,
  isRetrying,
}: RetryEmailDialogProps) {
  const { t } = useI18n();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('adminEmailQueue.retryConfirmTitle')}</DialogTitle>
          <DialogDescription>{t('adminEmailQueue.retryConfirmDescription')}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isRetrying}>
            {t('common.cancel')}
          </Button>
          <Button onClick={onConfirm} disabled={isRetrying}>
            {t('adminEmailQueue.retry')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
