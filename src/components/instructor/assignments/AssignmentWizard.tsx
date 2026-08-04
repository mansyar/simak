import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useI18n } from '../../../routes/__root';
import { toast } from 'sonner';
import { createAssignment } from '@/server/assignments';
import { getTemplate } from '@/server/templates';
import { listUsers } from '@/server/users';
import { userKeys } from '@/lib/query-keys';
import { isServerError } from '@/lib/errors';
import { TemplatePicker } from './TemplatePicker';
import { AssignmentDetailsForm } from './AssignmentDetailsForm';
import { StudentPicker } from './StudentPicker';
import { DueDatePreview } from './DueDatePreview';
import { ReviewStep } from './ReviewStep';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { CheckCircle2, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

interface Template {
  id: number;
  name: string;
  type: string;
  checkpoints: string[];
}

interface CheckpointDetail {
  name: string;
  order: number;
  estimatedDuration: number;
}

interface DueDateOverride {
  checkpointOrder: number;
  dueDate: string;
}

export function AssignmentWizard() {
  const { t } = useI18n();
  const navigate = useNavigate();

  // Wizard state
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [finalDeadline, setFinalDeadline] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  // Template checkpoint details (contains estimated_duration)
  const [checkpointDetails, setCheckpointDetails] = useState<CheckpointDetail[]>([]);
  // Due date overrides
  const [dueDateOverrides, setDueDateOverrides] = useState<DueDateOverride[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const {
    data: studentsData,
    isError: isStudentsError,
    refetch: refetchStudents,
  } = useQuery({
    queryKey: userKeys.list({ page: 1, limit: 200, search: '', role: 'student' }),
    queryFn: async () => {
      const response = await listUsers({
        data: { page: 1, limit: 200, search: '', role: 'student' },
      });
      if (isServerError(response)) {
        throw new Error(response.error.message);
      }
      return response;
    },
    retry: false,
  });

  const handleSelectTemplate = async (tpl: Template) => {
    setSelectedTemplate(tpl);
    setErrors((prev) => ({ ...prev, templateDetail: '' }));
    // Suggest a default title if not set
    if (!title) {
      setTitle(`${tpl.name} - Cohort ${new Date().getFullYear()}`);
    }
    setErrors((prev) => ({ ...prev, templateId: '' }));

    // Fetch template details to get estimated_durations
    try {
      const response = await getTemplate({ data: { id: tpl.id } });
      if (isServerError(response)) {
        throw new Error(response.error.message);
      }
      if (response && response.checkpoints) {
        const details: CheckpointDetail[] = response.checkpoints.map((cp) => ({
          name: cp.name,
          order: cp.order,
          estimatedDuration: cp.estimatedDuration ?? 7,
        }));
        setCheckpointDetails(details);
        // Reset overrides when template changes
        setDueDateOverrides([]);
      }
    } catch (err) {
      console.error('Failed to fetch template details', err);
      toast.error(t('errors.fetchFailed'));
      setErrors((prev) => ({ ...prev, templateDetail: t('errors.fetchFailed') }));
    }
  };

  const handleToggleStudent = (id: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id],
    );
    setErrors((prev) => ({ ...prev, studentIds: '' }));
  };

  const handleSelectAllStudents = (ids: string[]) => {
    setSelectedStudentIds(ids);
    setErrors((prev) => ({ ...prev, studentIds: '' }));
  };

  // Real-time step validations
  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 1) {
      if (!selectedTemplate) {
        newErrors.templateId = t('instructorAssignments.wizard.errors.templateRequired');
      }
    } else if (step === 2) {
      if (!title.trim()) {
        newErrors.title = t('instructorAssignments.wizard.errors.titleRequired');
      } else if (title.length < 3) {
        newErrors.title = t('instructorAssignments.wizard.errors.titleMinLength');
      }
      if (!finalDeadline) {
        newErrors.finalDeadline = t('instructorAssignments.wizard.errors.deadlineRequired');
      } else {
        const dateVal = new Date(finalDeadline);
        if (isNaN(dateVal.getTime())) {
          newErrors.finalDeadline = t('instructorAssignments.wizard.errors.deadlineInvalid');
        } else if (dateVal <= new Date()) {
          newErrors.finalDeadline = t('instructorAssignments.wizard.errors.deadlineInPast');
        }
      }
    } else if (step === 3) {
      if (selectedStudentIds.length === 0) {
        newErrors.studentIds = t('instructorAssignments.wizard.errors.studentsRequired');
      }
    } else if (step === 4) {
      // Client-side due date validation: overridden dates should not be in the past
      for (const override of dueDateOverrides) {
        const overrideDate = new Date(override.dueDate);
        if (overrideDate <= new Date()) {
          newErrors.dueDates = t('instructorAssignments.wizard.errors.dueDatesInPast');
          break;
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    setCurrentStep((prev) => prev - 1);
  };

  const handleSubmit = async () => {
    if (!validateStep(1) || !validateStep(2) || !validateStep(3) || !validateStep(4)) {
      return;
    }

    try {
      setIsSubmitting(true);
      const overrideDueDates = dueDateOverrides.length > 0 ? dueDateOverrides : undefined;
      const res = await createAssignment({
        data: {
          templateId: selectedTemplate?.id,
          title,
          description,
          finalDeadline: new Date(finalDeadline).toISOString(),
          studentIds: selectedStudentIds,
          overrideDueDates,
        },
      });

      if (isServerError(res)) {
        setErrors({ submit: res.error.message });
      } else {
        navigate({ to: ('/instructor/assignments/' + res.assignmentId) as never });
      }
    } catch (err) {
      console.error(err);
      toast.error(t('errors.fetchFailed'));
      setErrors({ submit: t('instructorAssignments.wizard.errors.networkError') });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Find student details for selected IDs to display in Review step
  const students = studentsData?.users ?? [];
  const assignedStudents = students.filter((s) => selectedStudentIds.includes(s.id));

  // Step definitions
  const steps = [
    { num: 1, label: t('instructorAssignments.wizard.stepTemplate') },
    { num: 2, label: t('instructorAssignments.wizard.stepDetails') },
    { num: 3, label: t('instructorAssignments.wizard.stepStudents') },
    { num: 4, label: t('instructorAssignments.wizard.stepDueDates') },
    { num: 5, label: t('instructorAssignments.wizard.stepConfirm') },
  ];

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto">
      {/* Wizard Header Progress Bar */}
      <div
        className="relative flex items-center justify-between border-b pb-6 select-none"
        role="list"
        aria-label={t('instructorAssignments.wizard.progressLabel')}
      >
        <div
          className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-0.5 bg-muted z-0"
          aria-hidden="true"
        />
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-primary transition-all duration-300 z-0"
          style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
          aria-hidden="true"
        />

        {steps.map((s) => {
          const isCompleted = currentStep > s.num;
          const isActive = currentStep === s.num;
          return (
            <div
              key={s.num}
              className="relative z-10 flex flex-col items-center gap-2"
              role="listitem"
              aria-current={isActive ? 'step' : undefined}
              aria-label={t('instructorAssignments.wizard.currentStep', {
                current: String(s.num),
                total: String(steps.length),
                label: s.label,
              })}
            >
              <div
                className={`h-9 w-9 rounded-full flex items-center justify-center border font-bold text-sm shadow-sm transition-all duration-300 ${
                  isCompleted
                    ? 'bg-primary border-primary text-primary-foreground'
                    : isActive
                      ? 'bg-background border-primary text-primary ring-4 ring-primary/10'
                      : 'bg-background border-muted-foreground/30 text-muted-foreground'
                }`}
              >
                {isCompleted ? <CheckCircle2 className="h-5 w-5" /> : s.num}
              </div>
              <span
                className={`hidden md:block text-xs font-semibold tracking-wide uppercase transition-colors ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                {s.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Mobile Step Label (UX-35) - shows current step name on mobile only */}
      <p
        className="sm:hidden text-sm font-semibold tracking-wide uppercase text-primary"
        aria-live="polite"
      >
        {steps[currentStep - 1].label}
      </p>

      {isStudentsError && currentStep !== 3 && (
        <ErrorState
          title={t('errors.fetchFailed')}
          retryLabel={t('common.retry')}
          onRetry={() => refetchStudents()}
        />
      )}

      {/* Step Components */}
      <div className="min-h-[300px]">
        {currentStep === 1 && (
          <div className="space-y-4">
            <TemplatePicker
              selectedTemplateId={selectedTemplate?.id ?? null}
              onSelectTemplate={handleSelectTemplate}
            />
            {errors.templateDetail && selectedTemplate && (
              <ErrorState
                title={errors.templateDetail}
                retryLabel={t('common.retry')}
                onRetry={() => handleSelectTemplate(selectedTemplate)}
              />
            )}
          </div>
        )}

        {currentStep === 2 && (
          <AssignmentDetailsForm
            title={title}
            onChangeTitle={setTitle}
            description={description}
            onChangeDescription={setDescription}
            finalDeadline={finalDeadline}
            onChangeDeadline={setFinalDeadline}
            errors={errors}
          />
        )}

        {currentStep === 3 && (
          <StudentPicker
            selectedStudentIds={selectedStudentIds}
            onToggleStudent={handleToggleStudent}
            onSelectAll={handleSelectAllStudents}
            onDeselectAll={() => handleSelectAllStudents([])}
            errors={errors}
          />
        )}

        {currentStep === 4 && (
          <div className="space-y-4">
            <DueDatePreview
              checkpoints={checkpointDetails}
              overrides={dueDateOverrides}
              onOverride={setDueDateOverrides}
            />
            {errors.dueDates && (
              <div
                className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm font-semibold border border-destructive/20"
                aria-live="polite"
                data-testid="error-due-dates"
              >
                {errors.dueDates}
              </div>
            )}
          </div>
        )}

        {currentStep === 5 && selectedTemplate && (
          <ReviewStep
            title={title}
            description={description}
            finalDeadline={finalDeadline}
            assignedStudents={assignedStudents}
            selectedTemplate={selectedTemplate}
            error={errors.submit}
          />
        )}
      </div>

      {/* Control Buttons */}
      <div className="flex justify-between items-center border-t pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={
            currentStep === 1
              ? () => navigate({ to: '/instructor/assignments' as never })
              : handlePrev
          }
          disabled={isSubmitting}
          className="font-semibold"
        >
          <ChevronLeft className="mr-1.5 h-4 w-4" />
          {currentStep === 1 ? t('common.cancel') : t('instructorAssignments.wizard.prev')}
        </Button>

        {currentStep < steps.length ? (
          <Button type="button" onClick={handleNext} className="font-semibold">
            {t('instructorAssignments.wizard.next')}
            <ChevronRight className="ml-1.5 h-4 w-4" />
          </Button>
        ) : (
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="font-bold min-w-[140px]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('instructorAssignments.wizard.submitting')}
              </>
            ) : (
              <>
                {t('instructorAssignments.wizard.submit')}
                <CheckCircle2 className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
