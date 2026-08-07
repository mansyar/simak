import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/routes/__root';
import type { AssignmentSectionOption } from './AssignmentContextControls';

export type AssignmentCopyOperation = 'clone' | 'rollover';

interface AssignmentCloneDialogProps {
  open: boolean;
  operation: AssignmentCopyOperation;
  sourceTitle: string;
  sections: AssignmentSectionOption[];
  isSubmitting?: boolean;
  hasError?: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: { targetSectionId: number; finalDeadline: Date; title?: string }) => void;
}

export function AssignmentCloneDialog({
  open,
  operation,
  sourceTitle,
  sections,
  isSubmitting = false,
  hasError = false,
  onOpenChange,
  onSubmit,
}: AssignmentCloneDialogProps) {
  const { t } = useI18n();
  const [targetSectionId, setTargetSectionId] = useState('');
  const [deadline, setDeadline] = useState('');
  const [title, setTitle] = useState('');

  const minimumDeadline = useMemo(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().slice(0, 10);
  }, []);

  useEffect(() => {
    if (!open) return;
    setTargetSectionId(String(sections.find((section) => section.status === 'active')?.id ?? ''));
    setDeadline('');
    setTitle('');
  }, [open, sections]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!targetSectionId || !deadline) return;

    onSubmit({
      targetSectionId: Number(targetSectionId),
      finalDeadline: new Date(`${deadline}T23:59:59.000Z`),
      title: title.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {operation === 'clone'
              ? t('instructorAssignments.cloneDialog.cloneTitle')
              : t('instructorAssignments.cloneDialog.rolloverTitle')}
          </DialogTitle>
          <DialogDescription>
            {t('instructorAssignments.cloneDialog.description', { title: sourceTitle })}
          </DialogDescription>
        </DialogHeader>

        <form className="grid gap-4" onSubmit={handleSubmit}>
          <label className="grid gap-1.5 text-sm font-medium">
            {t('instructorAssignments.cloneDialog.targetSection')}
            <select
              required
              value={targetSectionId}
              onChange={(event) => setTargetSectionId(event.target.value)}
              className="h-10 rounded-md border bg-background px-3"
            >
              <option value="" disabled>
                {t('instructorAssignments.context.selectSection')}
              </option>
              {sections.map((section) => (
                <option key={section.id} value={section.id} disabled={section.status !== 'active'}>
                  {section.label}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1.5 text-sm font-medium">
            {t('instructorAssignments.cloneDialog.deadline')}
            <Input
              required
              type="date"
              min={minimumDeadline}
              value={deadline}
              onChange={(event) => setDeadline(event.target.value)}
            />
          </label>

          <label className="grid gap-1.5 text-sm font-medium">
            {t('instructorAssignments.cloneDialog.title')}
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={100}
            />
          </label>

          {hasError && (
            <p role="alert" className="text-sm text-destructive">
              {t('instructorAssignments.wizard.errors.submitFailed')}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {operation === 'clone'
                ? t('instructorAssignments.actions.clone')
                : t('instructorAssignments.actions.rollover')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
