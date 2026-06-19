import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
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
function StatusBadge({ state, t }) {
  switch (state) {
    case 'passed':
      return _jsx(Badge, {
        variant: 'success',
        children: t('instructorAssignments.status.passed'),
      });
    case 'under_review':
      return _jsx(Badge, {
        variant: 'warning',
        children: t('instructorAssignments.status.under_review'),
      });
    case 'submitted':
      return _jsx(Badge, {
        variant: 'info',
        children: t('instructorAssignments.status.submitted'),
      });
    case 'revise':
      return _jsx(Badge, {
        variant: 'destructive',
        children: t('instructorAssignments.status.revise'),
      });
    case 'unlocked':
      return _jsx(Badge, {
        variant: 'default',
        children: t('instructorAssignments.status.unlocked'),
      });
    case 'locked':
    default:
      return _jsx(Badge, {
        variant: 'outline',
        children: t('instructorAssignments.status.locked'),
      });
  }
}
export function DeadlineManager({ students, assignmentId: _assignmentId }) {
  const { t } = useI18n();
  const [expandedStudents, setExpandedStudents] = useState(new Set());
  const [unlockTarget, setUnlockTarget] = useState(null);
  const [extendDates, setExtendDates] = useState({});
  const [error, setError] = useState(null);
  // Unlock mutation
  const unlockMutation = useMutation({
    mutationFn: async (checkpointId) => {
      const result = await unlockCheckpoint({ data: { checkpointId } });
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
    mutationFn: async ({ checkpointId, newDueDate }) => {
      const result = await extendDeadline({ data: { checkpointId, newDueDate } });
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
  const toggleStudent = useCallback((studentId) => {
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
    (checkpointId) => {
      const dateStr = extendDates[checkpointId];
      if (!dateStr) return;
      const newDueDate = new Date(dateStr);
      if (isNaN(newDueDate.getTime())) return;
      extendMutation.mutate({ checkpointId, newDueDate });
    },
    [extendDates, extendMutation],
  );
  const formatDate = (date) => {
    if (!date) return '—';
    try {
      return format(new Date(date), 'MMM d, yyyy');
    } catch {
      return '—';
    }
  };
  const isOverdue = (date) => {
    if (!date) return false;
    try {
      return new Date(date) < new Date();
    } catch {
      return false;
    }
  };
  if (students.length === 0) {
    return _jsxs('div', {
      className: 'rounded-md border bg-card p-6 shadow-sm',
      children: [
        _jsx('h3', {
          className: 'text-base font-semibold text-foreground mb-2',
          children: t('instructorAssignments.deadlineManager.title'),
        }),
        _jsx('p', {
          className: 'text-sm text-muted-foreground',
          children: t('instructorAssignments.deadlineManager.empty'),
        }),
      ],
    });
  }
  return _jsxs('div', {
    className: 'rounded-md border bg-card p-5 shadow-sm space-y-4',
    children: [
      _jsxs('h3', {
        className: 'text-base font-semibold text-foreground border-b pb-2 flex items-center gap-2',
        children: [
          _jsx(Clock, { className: 'h-4 w-4 text-muted-foreground' }),
          t('instructorAssignments.deadlineManager.title'),
        ],
      }),
      error &&
        _jsx('div', {
          className:
            'rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-400',
          children: error,
        }),
      students.map((student) => {
        const isExpanded = expandedStudents.has(student.id);
        const lockedCheckpoints = student.checkpoints.filter((cp) => cp.state === 'locked');
        return _jsxs(
          'div',
          {
            'data-testid': 'student-section',
            className: 'rounded-lg border bg-card',
            children: [
              _jsxs('button', {
                onClick: () => toggleStudent(student.id),
                className:
                  'flex w-full items-center justify-between p-3 hover:bg-muted/50 transition-colors rounded-lg text-left',
                children: [
                  _jsxs('div', {
                    className: 'flex items-center gap-2',
                    children: [
                      _jsx('span', {
                        className: 'font-medium text-foreground',
                        children: student.name,
                      }),
                      _jsx('span', {
                        className: 'text-xs text-muted-foreground',
                        children: student.email,
                      }),
                      lockedCheckpoints.length > 0 &&
                        _jsxs('span', {
                          className: 'text-xs text-red-500 dark:text-red-400',
                          children: ['(', lockedCheckpoints.length, ' locked)'],
                        }),
                    ],
                  }),
                  isExpanded
                    ? _jsx(ChevronUp, { className: 'h-4 w-4 text-muted-foreground' })
                    : _jsx(ChevronDown, { className: 'h-4 w-4 text-muted-foreground' }),
                ],
              }),
              isExpanded &&
                _jsx('div', {
                  className: 'border-t divide-y',
                  children: student.checkpoints.map((cp) =>
                    _jsxs(
                      'div',
                      {
                        className:
                          'flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between',
                        children: [
                          _jsxs('div', {
                            className: 'flex items-center gap-2 min-w-0',
                            children: [
                              _jsx('span', {
                                className: 'text-sm font-medium text-foreground truncate',
                                children: cp.name,
                              }),
                              _jsx(StatusBadge, { state: cp.state, t: t }),
                            ],
                          }),
                          _jsxs('div', {
                            className:
                              'flex items-center gap-1 text-xs text-muted-foreground shrink-0',
                            children: [
                              _jsxs('span', {
                                children: [
                                  t('instructorAssignments.deadlineManager.currentDeadline'),
                                  ':',
                                ],
                              }),
                              _jsx('span', {
                                className: `font-medium ${isOverdue(cp.dueDate) ? 'text-destructive' : ''}`,
                                children: formatDate(cp.dueDate),
                              }),
                            ],
                          }),
                          _jsxs('div', {
                            className: 'flex items-center gap-2 shrink-0',
                            children: [
                              cp.state === 'locked' &&
                                _jsxs(Button, {
                                  size: 'sm',
                                  variant: 'outline',
                                  onClick: () =>
                                    setUnlockTarget({
                                      checkpointId: cp.id,
                                      studentName: student.name,
                                      checkpointName: cp.name,
                                    }),
                                  children: [
                                    _jsx(Lock, { className: 'h-3.5 w-3.5 mr-1' }),
                                    t('instructorAssignments.deadlineManager.unlock'),
                                  ],
                                }),
                              _jsxs('div', {
                                className: 'flex items-center gap-1',
                                children: [
                                  _jsx(Input, {
                                    type: 'date',
                                    'data-testid': `extend-deadline-input-${cp.id}`,
                                    className: 'h-8 w-[140px] text-xs',
                                    value: extendDates[cp.id] ?? '',
                                    onChange: (e) => {
                                      setExtendDates((prev) => ({
                                        ...prev,
                                        [cp.id]: e.target.value,
                                      }));
                                    },
                                  }),
                                  _jsxs(Button, {
                                    size: 'sm',
                                    variant: 'outline',
                                    disabled: !extendDates[cp.id],
                                    onClick: () => handleExtend(cp.id),
                                    children: [
                                      extendMutation.isPending &&
                                      extendMutation.variables?.checkpointId === cp.id
                                        ? _jsx(Loader2, { className: 'h-3.5 w-3.5 animate-spin' })
                                        : _jsx(Clock, { className: 'h-3.5 w-3.5' }),
                                      _jsx('span', {
                                        className: 'ml-1',
                                        children: t('instructorAssignments.deadlineManager.extend'),
                                      }),
                                    ],
                                  }),
                                ],
                              }),
                            ],
                          }),
                        ],
                      },
                      cp.id,
                    ),
                  ),
                }),
            ],
          },
          student.id,
        );
      }),
      _jsx(Dialog, {
        open: !!unlockTarget,
        onOpenChange: (open) => {
          if (!open) setUnlockTarget(null);
        },
        children: _jsxs(DialogContent, {
          children: [
            _jsxs(DialogHeader, {
              children: [
                _jsx(DialogTitle, {
                  children: t('instructorAssignments.deadlineManager.unlockConfirm'),
                }),
                _jsx(DialogDescription, {
                  children: unlockTarget
                    ? t('instructorAssignments.deadlineManager.unlockWarning', {
                        checkpoint: unlockTarget.checkpointName,
                        student: unlockTarget.studentName,
                      })
                    : '',
                }),
              ],
            }),
            _jsxs(DialogFooter, {
              className: 'flex gap-2 justify-end',
              children: [
                _jsx(Button, {
                  variant: 'outline',
                  onClick: () => setUnlockTarget(null),
                  children: t('common.cancel'),
                }),
                _jsxs(Button, {
                  onClick: handleUnlock,
                  disabled: unlockMutation.isPending,
                  children: [
                    unlockMutation.isPending &&
                      _jsx(Loader2, {
                        'data-testid': 'unlock-loading',
                        className: 'h-4 w-4 animate-spin mr-2',
                      }),
                    t('common.confirm'),
                  ],
                }),
              ],
            }),
          ],
        }),
      }),
    ],
  });
}
