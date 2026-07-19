import { useState, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { updateTemplate, deleteTemplate, listTemplateAssignments } from '@/server/templates';
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
  }[];
}

interface AssignmentData {
  id: number;
  title: string;
  instructorName: string;
  studentCount: number;
  createdAt: Date | null;
}

const defaultCheckpoint = () => ({ name: '', minConsultations: 0, estimatedDuration: 7 });

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
      name: cp.name,
      minConsultations: cp.minConsultations ?? 0,
      estimatedDuration: cp.estimatedDuration ?? 7,
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
      setSaveError(t('adminTemplates.detail.saveError'));
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

  const fetchAssignments = async (page: number) => {
    if (!template) return;
    const result = await (
      listTemplateAssignmentsFn as unknown as (args: {
        data: { templateId: number; page: number; limit: number };
      }) => Promise<{ assignments?: AssignmentData[]; total?: number; error?: string }>
    )({
      data: { templateId: template.id, page, limit: 20 },
    });
    if (!result?.error) {
      setAssignmentsList(result?.assignments ?? []);
      setAssignmentsTotal(result?.total ?? 0);
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
