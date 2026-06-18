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

interface TemplateData {
  id: number;
  name: string;
  type: string;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  assignmentCount: number;
  checkpoints: {
    id: number;
    name: string;
    order: number;
    minConsultations: number | null;
    estimatedDuration: number | null;
  }[];
}

interface AssignmentData {
  id: number;
  title: string;
  instructorName: string;
  studentCount: number;
  createdAt: Date;
}

const defaultCheckpoint = () => ({ name: '', minConsultations: 0, estimatedDuration: 7 });

export function TemplateDetailPage({ template }: { template: TemplateData | null }) {
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
  const [saveError, setSaveError] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<AssignmentData[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(true);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const updateTemplateFn = useServerFn(updateTemplate);
  const deleteTemplateFn = useServerFn(deleteTemplate);
  const listAssignmentsFn = useServerFn(listTemplateAssignments);

  // Load linked assignments client-side
  useEffect(() => {
    if (!template) return;
    setAssignmentsLoading(true);
    (
      listAssignmentsFn as unknown as (args: {
        data: { templateId: number };
      }) => Promise<{ assignments: AssignmentData[] }>
    )({ data: { templateId: template.id } })
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

  const handleRemoveCheckpoint = useCallback((index: number) => {
    setCheckpoints((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleCheckpointChange = useCallback((index: number, value: string) => {
    setCheckpoints((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], name: value };
      return updated;
    });
  }, []);

  const handleMinConsultationsChange = useCallback((index: number, value: number) => {
    setCheckpoints((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], minConsultations: value };
      return updated;
    });
  }, []);

  const handleEstimatedDurationChange = useCallback((index: number, value: number) => {
    setCheckpoints((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], estimatedDuration: value };
      return updated;
    });
  }, []);

  const handleMoveUp = useCallback((index: number) => {
    if (index === 0) return;
    setCheckpoints((prev) => {
      const updated = [...prev];
      [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
      return updated;
    });
  }, []);

  const handleMoveDown = useCallback((index: number) => {
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
      const result = await (
        updateTemplateFn as unknown as (args: {
          data: { id: number; name: string; type: string; checkpoints: typeof checkpoints };
        }) => Promise<{ error?: string }>
      )({
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
    const result = await (
      deleteTemplateFn as unknown as (args: {
        data: { id: number };
      }) => Promise<{ success?: boolean; error?: string }>
    )({ data: { id: template.id } });
    if (result?.success) {
      navigate({ to: '/admin/templates', search: { page: 1, limit: 20, search: '', type: '' } });
    }
  };

  if (!template) return null;

  return (
    <div className="space-y-6">
      {/* Back navigation */}
      <Link
        to="/admin/templates"
        search={{ page: 1, limit: 20, search: '', type: '' }}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('adminTemplates.detail.back')}
      </Link>

      {/* Success banner */}
      {saveSuccess && (
        <div className="rounded-md bg-green-50 dark:bg-green-950/20 p-3 text-sm text-green-700 dark:text-green-400">
          {t('adminTemplates.detail.saveSuccess')}
        </div>
      )}

      {/* Error banner */}
      {saveError && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {t('common.error')}: {saveError}
        </div>
      )}

      {/* Metadata Card */}
      <Card>
        <CardHeader>
          <CardTitle>{t('adminTemplates.detail.metadata')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                {t('adminTemplates.form.name')}
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('adminTemplates.form.namePlaceholder')}
                data-testid="template-name"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                {t('adminTemplates.form.type')}
              </label>
              <Input
                value={type}
                onChange={(e) => setType(e.target.value)}
                placeholder={t('adminTemplates.form.typePlaceholder')}
                data-testid="template-type"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 text-sm text-muted-foreground">
            <div>
              <span className="font-medium">{t('adminTemplates.detail.created')}:</span>{' '}
              {format(new Date(template.createdAt ?? new Date()), 'MMM d, yyyy HH:mm')}
            </div>
            <div>
              <span className="font-medium">{t('adminTemplates.detail.createdBy')}:</span>{' '}
              {template.createdByName ?? template.createdBy}
            </div>
          </div>

          {/* In-use banner */}
          {template.assignmentCount > 0 && (
            <div className="flex items-start gap-2 rounded-md bg-muted p-3 text-sm">
              <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-500 shrink-0" />
              <span className="text-muted-foreground">
                {t('adminTemplates.inUseBanner', { count: String(template.assignmentCount) })}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Checkpoint Editor */}
      <Card>
        <CardHeader>
          <CardTitle>{t('adminTemplates.detail.checkpoints')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <CheckpointListEditor
            checkpoints={checkpoints}
            onAdd={handleAddCheckpoint}
            onRemove={handleRemoveCheckpoint}
            onChange={handleCheckpointChange}
            onMinConsultationsChange={handleMinConsultationsChange}
            onEstimatedDurationChange={handleEstimatedDurationChange}
            onMoveUp={handleMoveUp}
            onMoveDown={handleMoveDown}
          />
          <div className="flex gap-2 pt-2">
            <Button onClick={handleSave} disabled={isSaving} data-testid="save-template">
              {isSaving ? t('common.saving') : t('common.save')}
            </Button>
            <Link to="/admin/templates" search={{ page: 1, limit: 20, search: '', type: '' }}>
              <Button variant="outline" type="button">
                {t('common.cancel')}
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Linked Assignments */}
      <Card>
        <CardHeader>
          <CardTitle>{t('adminTemplates.detail.assignments')}</CardTitle>
        </CardHeader>
        <CardContent>
          {assignmentsLoading ? (
            <div className="space-y-2">
              {[1, 2].map((n) => (
                <div key={n} className="h-10 rounded bg-muted animate-pulse" />
              ))}
            </div>
          ) : assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('adminTemplates.detail.noAssignments')}
            </p>
          ) : (
            <div className="space-y-2">
              {assignments.map((a) => (
                <Link
                  key={a.id}
                  to="/instructor/assignments/$id"
                  params={{ id: String(a.id) }}
                  className="flex items-center justify-between rounded-md border p-3 text-sm hover:bg-accent transition-colors"
                >
                  <div>
                    <div className="font-medium text-foreground">{a.title}</div>
                    <div className="text-muted-foreground">
                      {a.instructorName} &middot; {a.studentCount} students
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(a.createdAt ?? new Date()), 'MMM d, yyyy')}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Section */}
      <Card className="border-destructive/20">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-foreground">
                {t('adminTemplates.actions.delete')}
              </h3>
              <p className="text-xs text-muted-foreground">{t('adminTemplates.deleteConfirm')}</p>
            </div>
            <Button
              variant="destructive"
              onClick={() => setIsDeleteOpen(true)}
              data-testid="delete-template"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {t('adminTemplates.actions.delete')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <DeleteTemplateDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        onConfirm={handleDelete}
        usageCount={template.assignmentCount}
      />
    </div>
  );
}
