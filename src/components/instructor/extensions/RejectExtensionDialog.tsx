import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useI18n } from '@/routes/__root';

const MIN_REASON_LENGTH = 20;

interface ExtensionRequestItem {
  id: number;
  studentId: string;
  studentName: string;
  checkpointId: number | null;
  checkpointName: string | null;
  category: string;
  reason: string;
  extensionDays: number;
  status: string;
  createdAt: Date | null;
}

interface RejectExtensionDialogProps {
  request: ExtensionRequestItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
}

export function RejectExtensionDialog({
  request,
  open,
  onOpenChange,
  onConfirm,
}: RejectExtensionDialogProps) {
  const { t } = useI18n();
  const [reason, setReason] = useState('');

  const isValid = reason.trim().length >= MIN_REASON_LENGTH;

  const handleConfirm = () => {
    if (!isValid) return;
    onConfirm(reason.trim());
    setReason('');
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setReason('');
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t('extensions.dialog.reject.title')}</DialogTitle>
          <DialogDescription>
            {t('extensions.dialog.reject.description', {
              student: request.studentName,
              count: String(request.extensionDays),
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              {t('extensions.queue.checkpoint')}
            </p>
            <p className="text-sm">{request.checkpointName ?? '-'}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              {t('extensions.queue.reason')}
            </p>
            <p className="text-sm text-muted-foreground">{request.reason}</p>
          </div>
          <div className="space-y-1">
            <label htmlFor="reject-reason" className="text-sm font-medium text-muted-foreground">
              {t('extensions.dialog.reject.reason')}
            </label>
            <Textarea
              id="reject-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder={t('extensions.dialog.reject.reasonPlaceholder')}
            />
            <p className="text-xs text-muted-foreground text-right">
              {t('extensions.dialog.reject.charCount', {
                count: String(reason.length),
                min: String(MIN_REASON_LENGTH),
              })}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            {t('extensions.dialog.reject.cancel')}
          </Button>
          <Button onClick={handleConfirm} disabled={!isValid}>
            {t('extensions.dialog.reject.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
