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
import type { TranslationKey } from '@/i18n/index';

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
              {t('extensions.queue.reason' as TranslationKey)}
            </p>
            <p className="text-sm text-muted-foreground">{request.reason}</p>
          </div>
          <div>
            <label htmlFor="approve-comment" className="text-sm font-medium text-muted-foreground">
              {t('extensions.dialog.approve.comment')}
            </label>
            <Textarea
              id="approve-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              size="sm"
              placeholder={t('extensions.dialog.approve.commentPlaceholder')}
              className="mt-1"
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
