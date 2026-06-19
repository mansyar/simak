import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { updateTemplate, deleteTemplate, listTemplateAssignments } from '@/server/templates';
import { CheckpointListEditor } from './CheckpointListEditor';
import { DeleteTemplateDialog } from './DeleteTemplateDialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertTriangle, ArrowLeft, Trash2 } from 'lucide-react';
import { format } from 'date-fns/format';
import { useI18n } from '../../../routes/__root';
const defaultCheckpoint = () => ({ name: '', minConsultations: 0, estimatedDuration: 7 });
export function TemplateDetailPage({ template }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [name, setName] = useState(template?.name ?? '');
  const [type, setType] = useState(template?.type ?? '');
  const [checkpoints, setCheckpoints] = useState(
    template?.checkpoints.map((cp) => ({
      name: cp.name,
      minConsultations: cp.minConsultations ?? 0,
      estimatedDuration: cp.estimatedDuration ?? 7,
    })) ?? [defaultCheckpoint()],
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(true);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const updateTemplateFn = useServerFn(updateTemplate);
  const deleteTemplateFn = useServerFn(deleteTemplate);
  const listAssignmentsFn = useServerFn(listTemplateAssignments);
  // Load linked assignments client-side
  useEffect(() => {
    if (!template) return;
    setAssignmentsLoading(true);
    listAssignmentsFn({ data: { templateId: template.id } })
      .then((result) => {
        setAssignments(result?.assignments ?? []);
      })
      .catch(() => {
        setAssignments([]);
      })
      .finally(() => {
        setAssignmentsLoading(false);
      });
  }, [template, listAssignmentsFn]);
  // Checkpoint handlers
  const handleAddCheckpoint = useCallback(() => {
    setCheckpoints((prev) => [...prev, defaultCheckpoint()]);
  }, []);
  const handleRemoveCheckpoint = useCallback((index) => {
    setCheckpoints((prev) => prev.filter((_, i) => i !== index));
  }, []);
  const handleCheckpointChange = useCallback((index, value) => {
    setCheckpoints((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], name: value };
      return updated;
    });
  }, []);
  const handleMinConsultationsChange = useCallback((index, value) => {
    setCheckpoints((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], minConsultations: value };
      return updated;
    });
  }, []);
  const handleEstimatedDurationChange = useCallback((index, value) => {
    setCheckpoints((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], estimatedDuration: value };
      return updated;
    });
  }, []);
  const handleMoveUp = useCallback((index) => {
    if (index === 0) return;
    setCheckpoints((prev) => {
      const updated = [...prev];
      [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
      return updated;
    });
  }, []);
  const handleMoveDown = useCallback((index) => {
    setCheckpoints((prev) => {
      if (index >= prev.length - 1) return prev;
      const updated = [...prev];
      [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
      return updated;
    });
  }, []);
  const handleSave = async () => {
    if (!template) return;
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const result = await updateTemplateFn({
        data: { id: template.id, name, type, checkpoints },
      });
      if (result?.error) {
        setSaveError(result.error);
      } else {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch {
      setSaveError('Failed to save template');
    } finally {
      setIsSaving(false);
    }
  };
  const handleDelete = async () => {
    if (!template) return;
    const result = await deleteTemplateFn({ data: { id: template.id } });
    if (result?.success) {
      navigate({ to: '/admin/templates', search: { page: 1, limit: 20, search: '', type: '' } });
    }
  };
  if (!template) return null;
  return _jsxs('div', {
    className: 'space-y-6',
    children: [
      _jsxs(Link, {
        to: '/admin/templates',
        search: { page: 1, limit: 20, search: '', type: '' },
        className:
          'inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary transition-colors',
        children: [_jsx(ArrowLeft, { className: 'h-4 w-4' }), t('adminTemplates.detail.back')],
      }),
      saveSuccess &&
        _jsx('div', {
          className:
            'rounded-md bg-green-50 dark:bg-green-950/20 p-3 text-sm text-green-700 dark:text-green-400',
          children: t('adminTemplates.detail.saveSuccess'),
        }),
      saveError &&
        _jsxs('div', {
          className: 'rounded-md bg-destructive/10 p-3 text-sm text-destructive',
          children: [t('common.error'), ': ', saveError],
        }),
      _jsxs(Card, {
        children: [
          _jsx(CardHeader, {
            children: _jsx(CardTitle, { children: t('adminTemplates.detail.metadata') }),
          }),
          _jsxs(CardContent, {
            className: 'space-y-4',
            children: [
              _jsxs('div', {
                className: 'grid gap-4 sm:grid-cols-2',
                children: [
                  _jsxs('div', {
                    className: 'space-y-2',
                    children: [
                      _jsx('label', {
                        className: 'text-sm font-medium text-foreground',
                        children: t('adminTemplates.form.name'),
                      }),
                      _jsx(Input, {
                        value: name,
                        onChange: (e) => setName(e.target.value),
                        placeholder: t('adminTemplates.form.namePlaceholder'),
                        'data-testid': 'template-name',
                      }),
                    ],
                  }),
                  _jsxs('div', {
                    className: 'space-y-2',
                    children: [
                      _jsx('label', {
                        className: 'text-sm font-medium text-foreground',
                        children: t('adminTemplates.form.type'),
                      }),
                      _jsx(Input, {
                        value: type,
                        onChange: (e) => setType(e.target.value),
                        placeholder: t('adminTemplates.form.typePlaceholder'),
                        'data-testid': 'template-type',
                      }),
                    ],
                  }),
                ],
              }),
              _jsxs('div', {
                className: 'grid gap-4 sm:grid-cols-2 text-sm text-muted-foreground',
                children: [
                  _jsxs('div', {
                    children: [
                      _jsxs('span', {
                        className: 'font-medium',
                        children: [t('adminTemplates.detail.created'), ':'],
                      }),
                      ' ',
                      format(new Date(template.createdAt ?? new Date()), 'MMM d, yyyy HH:mm'),
                    ],
                  }),
                  _jsxs('div', {
                    children: [
                      _jsxs('span', {
                        className: 'font-medium',
                        children: [t('adminTemplates.detail.createdBy'), ':'],
                      }),
                      ' ',
                      template.createdByName ?? template.createdBy,
                    ],
                  }),
                ],
              }),
              template.assignmentCount > 0 &&
                _jsxs('div', {
                  className: 'flex items-start gap-2 rounded-md bg-muted p-3 text-sm',
                  children: [
                    _jsx(AlertTriangle, { className: 'h-4 w-4 mt-0.5 text-amber-500 shrink-0' }),
                    _jsx('span', {
                      className: 'text-muted-foreground',
                      children: t('adminTemplates.inUseBanner', {
                        count: String(template.assignmentCount),
                      }),
                    }),
                  ],
                }),
            ],
          }),
        ],
      }),
      _jsxs(Card, {
        children: [
          _jsx(CardHeader, {
            children: _jsx(CardTitle, { children: t('adminTemplates.detail.checkpoints') }),
          }),
          _jsxs(CardContent, {
            className: 'space-y-4',
            children: [
              _jsx(CheckpointListEditor, {
                checkpoints: checkpoints,
                onAdd: handleAddCheckpoint,
                onRemove: handleRemoveCheckpoint,
                onChange: handleCheckpointChange,
                onMinConsultationsChange: handleMinConsultationsChange,
                onEstimatedDurationChange: handleEstimatedDurationChange,
                onMoveUp: handleMoveUp,
                onMoveDown: handleMoveDown,
              }),
              _jsxs('div', {
                className: 'flex gap-2 pt-2',
                children: [
                  _jsx(Button, {
                    onClick: handleSave,
                    disabled: isSaving,
                    'data-testid': 'save-template',
                    children: isSaving ? t('common.saving') : t('common.save'),
                  }),
                  _jsx(Link, {
                    to: '/admin/templates',
                    search: { page: 1, limit: 20, search: '', type: '' },
                    children: _jsx(Button, {
                      variant: 'outline',
                      type: 'button',
                      children: t('common.cancel'),
                    }),
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
      _jsxs(Card, {
        children: [
          _jsx(CardHeader, {
            children: _jsx(CardTitle, { children: t('adminTemplates.detail.assignments') }),
          }),
          _jsx(CardContent, {
            children: assignmentsLoading
              ? _jsx('div', {
                  className: 'space-y-2',
                  children: [1, 2].map((n) =>
                    _jsx('div', { className: 'h-10 rounded bg-muted animate-pulse' }, n),
                  ),
                })
              : assignments.length === 0
                ? _jsx('p', {
                    className: 'text-sm text-muted-foreground',
                    children: t('adminTemplates.detail.noAssignments'),
                  })
                : _jsx('div', {
                    className: 'space-y-2',
                    children: assignments.map((a) =>
                      _jsxs(
                        Link,
                        {
                          to: '/instructor/assignments/$id',
                          params: { id: String(a.id) },
                          className:
                            'flex items-center justify-between rounded-md border p-3 text-sm hover:bg-accent transition-colors',
                          children: [
                            _jsxs('div', {
                              children: [
                                _jsx('div', {
                                  className: 'font-medium text-foreground',
                                  children: a.title,
                                }),
                                _jsxs('div', {
                                  className: 'text-muted-foreground',
                                  children: [
                                    a.instructorName,
                                    ' \u00B7 ',
                                    a.studentCount,
                                    ' students',
                                  ],
                                }),
                              ],
                            }),
                            _jsx('div', {
                              className: 'text-xs text-muted-foreground',
                              children: format(new Date(a.createdAt ?? new Date()), 'MMM d, yyyy'),
                            }),
                          ],
                        },
                        a.id,
                      ),
                    ),
                  }),
          }),
        ],
      }),
      _jsx(Card, {
        className: 'border-destructive/20',
        children: _jsx(CardContent, {
          className: 'pt-6',
          children: _jsxs('div', {
            className: 'flex items-center justify-between',
            children: [
              _jsxs('div', {
                children: [
                  _jsx('h3', {
                    className: 'text-sm font-medium text-foreground',
                    children: t('adminTemplates.actions.delete'),
                  }),
                  _jsx('p', {
                    className: 'text-xs text-muted-foreground',
                    children: t('adminTemplates.deleteConfirm'),
                  }),
                ],
              }),
              _jsxs(Button, {
                variant: 'destructive',
                onClick: () => setIsDeleteOpen(true),
                'data-testid': 'delete-template',
                children: [
                  _jsx(Trash2, { className: 'mr-2 h-4 w-4' }),
                  t('adminTemplates.actions.delete'),
                ],
              }),
            ],
          }),
        }),
      }),
      _jsx(DeleteTemplateDialog, {
        open: isDeleteOpen,
        onOpenChange: setIsDeleteOpen,
        onConfirm: handleDelete,
        usageCount: template.assignmentCount,
      }),
    ],
  });
}
