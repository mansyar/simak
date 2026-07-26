import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
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
import { gradebookKeys } from '@/lib/query-keys';

interface RecomputeGradesButtonProps {
  assignmentId: number;
  isAdmin: boolean;
}

export function RecomputeGradesButton({ assignmentId, isAdmin }: RecomputeGradesButtonProps) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const recomputeMutation = useMutation({
    mutationFn: async () => {
      const result = await recomputeAllGrades({ data: { assignmentId } });
      if (isServerError(result)) throw result;
      return result;
    },
    onSuccess: (result) => {
      toast.success(t('gradebook.recomputeSuccess', { count: String(result.count) }));
      queryClient.invalidateQueries({ queryKey: gradebookKeys.studentFinalGrade(assignmentId) });
      router.invalidate();
      setOpen(false);
    },
    onError: () => toast.error(t('gradebook.recomputeError')),
  });

  if (!isAdmin) return null;

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
            <Button
              onClick={() => recomputeMutation.mutate()}
              loading={recomputeMutation.isPending}
            >
              {t('common.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
