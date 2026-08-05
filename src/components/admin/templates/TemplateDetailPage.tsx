import { useState, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { updateTemplate, deleteTemplate, listTemplateAssignments } from '@/server/templates';
import { saveRubric } from '@/server/rubrics';
import { getErrorTranslationKey, isServerError } from '@/lib/errors';
import { TemplateMetadata } from './TemplateMetadata';
import { TemplateCheckpointSection } from './TemplateCheckpointSection';
import { TemplateLinkedAssignments } from './TemplateLinkedAssignments';
import { TemplateDangerZone } from './TemplateDangerZone';
import { BackLink } from '@/components/ui/back-link';
import { AlertBanner } from '@/components/ui/alert-banner';
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
    gradingType: 'numeric' | 'qualitative' | null;
  }[];
}

interface AssignmentData {
  id: number;
  title: string;
  instructorName: string;
  studentCount: number;
  createdAt: Date | null;
}

const defaultCheckpoint = () => ({
  id: undefined as number | undefined,
  name: '',
  minConsultations: 0,
  estimatedDuration: 7,
  gradingType: null as 'numeric' | 'qualitative' | null,
});

export function TemplateDetailPage({
  template,
  assignments: initialAssignments,
  assignmentsTotal: initialTotal,
}: {
  template: TemplateData | null;
  assignments?: AssignmentData[];
  assignmentsTotal?: number;
}) {
  const { t } = useI18n();
  const navigate = useNavigate();

  const [name, setName] = useState(template?.name ?? '');
  const [type, setType] = useState(template?.type ?? '');
  const [checkpoints, setCheckpoints] = useState(
    template?.checkpoints.map((cp) => ({
      id: cp.id,
      name: cp.name,
      minConsultations: cp.minConsultations ?? 0,
      estimatedDuration: cp.estimatedDuration ?? 7,
      gradingType: cp.gradingType ?? null,
    })) ?? [defaultCheckpoint()],
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [assignmentsList, setAssignmentsList] = useState(initialAssignments ?? []);
  const [assignmentsPage, setAssignmentsPage] = useState(1);
  const [assignmentsTotal, setAssignmentsTotal] = useState(initialTotal ?? 0);

  const updateTemplateFn = useServerFn(updateTemplate);
  const deleteTemplateFn = useServerFn(deleteTemplate);
  const listTemplateAssignmentsFn = useServerFn(listTemplateAssignments);
  const saveRubricFn = useServerFn(saveRubric);

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

  const handleGradingTypeChange = useCallback(
    async (index: number, gradingType: 'numeric' | 'qualitative' | null) => {
      const checkpointId = checkpoints[index]?.id;
      const prevGradingType = checkpoints[index]?.gradingType ?? null;

      setCheckpoints((prev) => {
        const updated = [...prev];
        updated[index] = { ...updated[index], gradingType };
        return updated;
      });

      // When clearing rubric (null), immediately persist to DB
      if (gradingType === null && checkpointId) {
        try {
          const result = await saveRubricFn({
            data: {
              templateCheckpointId: checkpointId,
              gradingType: null,
              criteria: [],
              levels: [],
            },
          });
          if (isServerError(result)) {
            setSaveError(t(getErrorTranslationKey(result.error.code)));
            setCheckpoints((prev) => {
              const updated = [...prev];
              updated[index] = { ...updated[index], gradingType: prevGradingType };
              return updated;
            });
          }
        } catch {
          setSaveError(t('adminTemplates.detail.saveError'));
          setCheckpoints((prev) => {
            const updated = [...prev];
            updated[index] = { ...updated[index], gradingType: prevGradingType };
            return updated;
          });
        }
      }
    },
    [checkpoints, saveRubricFn, t],
  );

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
      const result = await updateTemplateFn({
        data: { id: template.id, name, type, checkpoints },
      });
      if (isServerError(result)) {
        setSaveError(t(getErrorTranslationKey(result.error.code)));
      } else {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch {
      setSaveError(t('adminTemplates.detail.saveError'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!template) return;
    const result = await deleteTemplateFn({ data: { id: template.id } });
    if (!isServerError(result)) {
      navigate({ to: '/admin/templates', search: { page: 1, limit: 20, search: '', type: '' } });
    }
  };

  const fetchAssignments = async (page: number) => {
    if (!template) return;
    const result = await listTemplateAssignmentsFn({
      data: { templateId: template.id, page, limit: 20 },
    });
    if (!isServerError(result)) {
      setAssignmentsList(result.assignments);
      setAssignmentsTotal(result.total);
    }
  };

  const handleAssignmentsPageChange = (page: number) => {
    setAssignmentsPage(page);
    fetchAssignments(page);
  };

  if (!template) return null;

  return (
    <div className="space-y-6">
      <BackLink
        to="/admin/templates"
        label={t('adminTemplates.detail.back')}
        search={{ page: 1, limit: 20, search: '', type: '' }}
      />

      <h1 className="font-display text-3xl text-foreground">{template.name}</h1>

      {saveSuccess && (
        <AlertBanner variant="success" title={t('adminTemplates.detail.saveSuccess')} />
      )}

      {saveError && <AlertBanner variant="error" title={`${t('common.error')}: ${saveError}`} />}

      <TemplateMetadata
        template={template}
        name={name}
        onNameChange={setName}
        type={type}
        onTypeChange={setType}
      />

      <TemplateCheckpointSection
        checkpoints={checkpoints}
        onAdd={handleAddCheckpoint}
        onRemove={handleRemoveCheckpoint}
        onChange={handleCheckpointChange}
        onMinConsultationsChange={handleMinConsultationsChange}
        onEstimatedDurationChange={handleEstimatedDurationChange}
        onMoveUp={handleMoveUp}
        onMoveDown={handleMoveDown}
        onGradingTypeChange={handleGradingTypeChange}
        onSave={handleSave}
        isSaving={isSaving}
      />

      <TemplateLinkedAssignments
        assignments={assignmentsList}
        currentPage={assignmentsPage}
        totalPages={Math.max(1, Math.ceil(assignmentsTotal / 20))}
        onPageChange={handleAssignmentsPageChange}
      />

      <TemplateDangerZone assignmentCount={template.assignmentCount} onDelete={handleDelete} />
    </div>
  );
}
