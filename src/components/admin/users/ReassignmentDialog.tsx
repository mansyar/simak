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
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import { useI18n } from '../../../routes/__root';

interface ReassignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignments: { id: number; title: string }[];
  instructors: { id: string; name: string }[];
  onReassign: (assignmentId: number, newInstructorId: string) => Promise<void>;
  onDelete: () => void;
}

export function ReassignmentDialog({
  open,
  onOpenChange,
  assignments,
  instructors,
  onReassign,
  onDelete,
}: ReassignmentDialogProps) {
  const { t } = useI18n();
  const [reassigned, setReassigned] = useState<Set<number>>(new Set());
  const [selectedInstructors, setSelectedInstructors] = useState<Record<number, string>>({});
  const [isReassigning, setIsReassigning] = useState(false);

  const handleSelectInstructor = async (assignmentId: number, instructorId: string) => {
    setSelectedInstructors((prev) => ({ ...prev, [assignmentId]: instructorId }));
    setIsReassigning(true);
    try {
      await onReassign(assignmentId, instructorId);
      setReassigned((prev) => new Set(prev).add(assignmentId));
    } catch (err) {
      // Reset selection so the user can retry
      setSelectedInstructors((prev) => {
        const next = { ...prev };
        delete next[assignmentId];
        return next;
      });
      console.error('Reassignment failed:', err);
    } finally {
      setIsReassigning(false);
    }
  };

  const allReassigned = reassigned.size === assignments.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden="true" />
            {t('adminUsers.reassignTitle')}
          </DialogTitle>
          <DialogDescription>{t('adminUsers.reassignDescription')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {assignments.map((assignment) => (
            <div key={assignment.id} className="flex items-center gap-4">
              <span className="flex-1 font-medium">{assignment.title}</span>
              {reassigned.has(assignment.id) ? (
                <Badge variant="success" className="gap-1.5">
                  <CheckCircle className="h-3.5 w-3.5" aria-hidden="true" />
                  {t('common.done')}
                </Badge>
              ) : (
                <Select
                  value={selectedInstructors[assignment.id] ?? ''}
                  onValueChange={(value) => {
                    if (value) handleSelectInstructor(assignment.id, value);
                  }}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder={t('adminUsers.selectInstructor')} />
                  </SelectTrigger>
                  <SelectContent>
                    {instructors.map((instructor) => (
                      <SelectItem key={instructor.id} value={instructor.id}>
                        {instructor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onDelete}
            disabled={!allReassigned || isReassigning}
          >
            {t('common.delete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
