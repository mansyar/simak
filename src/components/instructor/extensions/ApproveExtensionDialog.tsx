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
import { useI18n } from '@/routes/__root';

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
  createdAt: Date;
}

interface ApproveExtensionDialogProps {
  request: ExtensionRequestItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (comment?: string) => void;
}

export function ApproveExtensionDialog({
  request,
  open,
  onOpenChange,
  onConfirm,
}: ApproveExtensionDialogProps) {
  const { t } = useI18n();
  const [comment, setComment] = useState('');

  const handleConfirm = () => {
    onConfirm(comment || undefined);
    setComment('');
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setComment('');
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t('extensions.dialog.approve.title')}</DialogTitle>
          <DialogDescription>
            {t('extensions.dialog.approve.description', {
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
          <div>
            <label htmlFor="approve-comment" className="text-sm font-medium text-muted-foreground">
              {t('extensions.dialog.approve.comment')}
            </label>
            <textarea
              id="approve-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              className="mt-1 flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              placeholder={t('extensions.dialog.approve.commentPlaceholder')}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            {t('extensions.dialog.approve.cancel')}
          </Button>
          <Button onClick={handleConfirm}>{t('extensions.dialog.approve.confirm')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
