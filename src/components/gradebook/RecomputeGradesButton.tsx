import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useI18n } from '@/routes/__root';
import { recomputeAllGrades } from '@/server/gradebook';
import { isServerError } from '@/lib/errors';

interface RecomputeGradesButtonProps {
  assignmentId: number;
  isAdmin: boolean;
}

export function RecomputeGradesButton({ assignmentId, isAdmin }: RecomputeGradesButtonProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isAdmin) return null;

  const handleRecompute = async () => {
    setLoading(true);
    try {
      const result = await recomputeAllGrades({ data: { assignmentId } });
      if (isServerError(result)) {
        toast.error(t('gradebook.recomputeError'));
      } else {
        toast.success(t('gradebook.recomputeSuccess', { count: String(result.count) }));
        setOpen(false);
      }
    } catch {
      toast.error(t('gradebook.recomputeError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        {t('gradebook.recomputeAll')}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!v) setOpen(false);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('gradebook.recomputeAll')}</DialogTitle>
            <DialogDescription>{t('gradebook.recomputeConfirm')}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleRecompute} loading={loading}>
              {t('common.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
