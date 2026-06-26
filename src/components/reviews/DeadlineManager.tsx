import { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { unlockCheckpoint, extendDeadline } from '@/server/assignments';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useI18n } from '../../routes/__root';
import { format } from 'date-fns/format';
import { Loader2, ChevronDown, ChevronUp, Clock, Lock } from 'lucide-react';

interface CheckpointData {
  id: number;
  name: string;
  order: number;
  state: string;
  studentId: string;
  dueDate: Date | string | null;
  minConsultations: number | null;
}

interface StudentData {
  id: string;
  name: string;
  email: string;
  progressPercent: number;
  passedCount: number;
  totalCheckpointsCount: number;
  activeCheckpoint: { id: number; name: string; state: string } | null;
  checkpoints: CheckpointData[];
}

interface DeadlineManagerProps {
  students: StudentData[];
  assignmentId: number;
}

import type { TranslationKey } from '../../i18n/index';

function StatusBadge({ state, t }: { state: string; t: (key: TranslationKey) => string }) {
  switch (state) {
    case 'passed':
      return <Badge variant="success">{t('instructorAssignments.status.passed')}</Badge>;
    case 'under_review':
      return <Badge variant="warning">{t('instructorAssignments.status.under_review')}</Badge>;
    case 'submitted':
      return <Badge variant="info">{t('instructorAssignments.status.submitted')}</Badge>;
    case 'revise':
      return <Badge variant="destructive">{t('instructorAssignments.status.revise')}</Badge>;
    case 'unlocked':
      return <Badge variant="default">{t('instructorAssignments.status.unlocked')}</Badge>;
    case 'locked':
    default:
      return <Badge variant="outline">{t('instructorAssignments.status.locked')}</Badge>;
  }
}

export function DeadlineManager({ students, assignmentId: _assignmentId }: DeadlineManagerProps) {
  const { t } = useI18n();
  const [expandedStudents, setExpandedStudents] = useState<Set<string>>(new Set());
  const [unlockTarget, setUnlockTarget] = useState<{
    checkpointId: number;
    studentName: string;
    checkpointName: string;
  } | null>(null);
  const [extendDates, setExtendDates] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);

  // Unlock mutation
  const unlockMutation = useMutation({
    mutationFn: async (checkpointId: number) => {
      const result = await (
        unlockCheckpoint as unknown as (args: {
          data: { checkpointId: number };
        }) => Promise<unknown>
      )({ data: { checkpointId } });
      return result;
    },
    onSuccess: () => {
      setUnlockTarget(null);
      setError(null);
    },
    onError: () => {
      setError(t('instructorAssignments.deadlineManager.unlockError'));
    },
  });

  // Extend deadline mutation
  const extendMutation = useMutation({
    mutationFn: async ({
      checkpointId,
      newDueDate,
    }: {
      checkpointId: number;
      newDueDate: Date;
    }) => {
      const result = await (
        extendDeadline as unknown as (args: {
          data: { checkpointId: number; newDueDate: Date };
        }) => Promise<unknown>
      )({ data: { checkpointId, newDueDate } });
      return result;
    },
    onSuccess: (_data, variables) => {
      setExtendDates((prev) => {
        const next = { ...prev };
        delete next[variables.checkpointId];
        return next;
      });
      setError(null);
    },
    onError: () => {
      setError(t('instructorAssignments.deadlineManager.extendError'));
    },
  });

  const toggleStudent = useCallback((studentId: string) => {
    setExpandedStudents((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
  }, []);

  const handleUnlock = useCallback(() => {
    if (unlockTarget) {
      unlockMutation.mutate(unlockTarget.checkpointId);
    }
  }, [unlockTarget, unlockMutation]);

  const handleExtend = useCallback(
    (checkpointId: number) => {
      const dateStr = extendDates[checkpointId];
      if (!dateStr) return;
      const newDueDate = new Date(dateStr);
      if (isNaN(newDueDate.getTime())) return;
      extendMutation.mutate({ checkpointId, newDueDate });
    },
    [extendDates, extendMutation],
  );

  const formatDate = (date: Date | string | null) => {
    if (!date) return '—';
    try {
      return format(new Date(date), 'MMM d, yyyy');
    } catch {
      return '—';
    }
  };

  const isOverdue = (date: Date | string | null) => {
    if (!date) return false;
    try {
      return new Date(date) < new Date();
    } catch {
      return false;
    }
  };

  if (students.length === 0) {
    return (
      <div className="rounded-md border bg-card p-6 shadow-sm">
        <h3 className="text-base font-semibold text-foreground mb-2">
          {t('instructorAssignments.deadlineManager.title')}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t('instructorAssignments.deadlineManager.empty')}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-card p-5 shadow-sm space-y-4">
      <h3 className="text-base font-semibold text-foreground border-b pb-2 flex items-center gap-2">
        <Clock className="h-4 w-4 text-muted-foreground" />
        {t('instructorAssignments.deadlineManager.title')}
      </h3>

      {/* Error banner */}
      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Student list */}
      {students.map((student) => {
        const isExpanded = expandedStudents.has(student.id);
        const lockedCheckpoints = student.checkpoints.filter((cp) => cp.state === 'locked');

        return (
          <div key={student.id} data-testid="student-section" className="rounded-lg border bg-card">
            {/* Student header */}
            <button
              onClick={() => toggleStudent(student.id)}
              className="flex w-full items-center justify-between p-3 hover:bg-muted/50 transition-colors rounded-lg text-left"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">{student.name}</span>
                <span className="text-xs text-muted-foreground">{student.email}</span>
                {lockedCheckpoints.length > 0 && (
                  <span className="text-xs text-red-500 dark:text-red-400">
                    ({lockedCheckpoints.length} locked)
                  </span>
                )}
              </div>
              {isExpanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>

            {/* Checkpoint rows */}
            {isExpanded && (
              <div className="border-t divide-y">
                {student.checkpoints.map((cp) => (
                  <div
                    key={cp.id}
                    className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    {/* Checkpoint info */}
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium text-foreground truncate">
                        {cp.name}
                      </span>
                      <StatusBadge state={cp.state} t={t} />
                    </div>

                    {/* Current deadline */}
                    <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                      <span>{t('instructorAssignments.deadlineManager.currentDeadline')}:</span>
                      <span
                        className={`font-medium ${isOverdue(cp.dueDate) ? 'text-destructive' : ''}`}
                      >
                        {formatDate(cp.dueDate)}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Unlock button */}
                      {cp.state === 'locked' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setUnlockTarget({
                              checkpointId: cp.id,
                              studentName: student.name,
                              checkpointName: cp.name,
                            })
                          }
                        >
                          <Lock className="h-3.5 w-3.5 mr-1" />
                          {t('instructorAssignments.deadlineManager.unlock')}
                        </Button>
                      )}

                      {/* Extend deadline */}
                      <div className="flex items-center gap-1">
                        <Input
                          type="date"
                          data-testid={`extend-deadline-input-${cp.id}`}
                          className="h-8 w-[140px] text-xs"
                          value={extendDates[cp.id] ?? ''}
                          onChange={(e) => {
                            setExtendDates((prev) => ({
                              ...prev,
                              [cp.id]: e.target.value,
                            }));
                          }}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!extendDates[cp.id]}
                          onClick={() => handleExtend(cp.id)}
                        >
                          {extendMutation.isPending &&
                          extendMutation.variables?.checkpointId === cp.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Clock className="h-3.5 w-3.5" />
                          )}
                          <span className="ml-1">
                            {t('instructorAssignments.deadlineManager.extend')}
                          </span>
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Unlock confirmation dialog */}
      <Dialog
        open={!!unlockTarget}
        onOpenChange={(open) => {
          if (!open) setUnlockTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('instructorAssignments.deadlineManager.unlockConfirm')}</DialogTitle>
            <DialogDescription>
              {unlockTarget
                ? t('instructorAssignments.deadlineManager.unlockWarning', {
                    checkpoint: unlockTarget.checkpointName,
                    student: unlockTarget.studentName,
                  })
                : ''}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setUnlockTarget(null)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleUnlock} disabled={unlockMutation.isPending}>
              {unlockMutation.isPending && (
                <Loader2 data-testid="unlock-loading" className="h-4 w-4 animate-spin mr-2" />
              )}
              {t('common.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
