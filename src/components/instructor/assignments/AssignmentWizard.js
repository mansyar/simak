import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from 'react/jsx-runtime';
import { useState, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useI18n } from '../../../routes/__root';
import { createAssignment } from '@/server/assignments';
import { getTemplate } from '@/server/templates';
import { listUsers } from '@/server/users';
import { TemplatePicker } from './TemplatePicker';
import { AssignmentDetailsForm } from './AssignmentDetailsForm';
import { StudentPicker } from './StudentPicker';
import { DueDatePreview } from './DueDatePreview';
import { ReviewStep } from './ReviewStep';
import { Button } from '@/components/ui/button';
import { CheckCircle2, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
export function AssignmentWizard() {
  const { t } = useI18n();
  const navigate = useNavigate();
  // Wizard state
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [finalDeadline, setFinalDeadline] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  // Template checkpoint details (contains estimated_duration)
  const [checkpointDetails, setCheckpointDetails] = useState([]);
  // Due date overrides
  const [dueDateOverrides, setDueDateOverrides] = useState([]);
  // List of all students for lookup in final review step
  const [students, setStudents] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  useEffect(() => {
    // Load student list so we have their names/emails for the summary screen
    async function loadStudents() {
      try {
        const response = await listUsers({
          data: { page: 1, limit: 200, search: '', role: 'student' },
        });
        if (response && response.users) {
          setStudents(response.users);
        }
      } catch (err) {
        console.error('Failed to pre-fetch student names', err);
      }
    }
    loadStudents();
  }, []);
  const handleSelectTemplate = async (tpl) => {
    setSelectedTemplate(tpl);
    // Suggest a default title if not set
    if (!title) {
      setTitle(`${tpl.name} - Cohort ${new Date().getFullYear()}`);
    }
    setErrors((prev) => ({ ...prev, templateId: '' }));
    // Fetch template details to get estimated_durations
    try {
      const response = await getTemplate({ data: { id: tpl.id } });
      if (response && response.checkpoints) {
        const details = response.checkpoints.map((cp) => ({
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
    }
  };
  const handleToggleStudent = (id) => {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id],
    );
    setErrors((prev) => ({ ...prev, studentIds: '' }));
  };
  const handleSelectAllStudents = (ids) => {
    setSelectedStudentIds(ids);
    setErrors((prev) => ({ ...prev, studentIds: '' }));
  };
  // Real-time step validations
  const validateStep = (step) => {
    const newErrors = {};
    if (step === 1) {
      if (!selectedTemplate) {
        newErrors.templateId = 'Please select a template';
      }
    } else if (step === 2) {
      if (!title.trim()) {
        newErrors.title = 'Title is required';
      } else if (title.length < 3) {
        newErrors.title = 'Title must be at least 3 characters';
      }
      if (!finalDeadline) {
        newErrors.finalDeadline = 'Deadline is required';
      } else {
        const dateVal = new Date(finalDeadline);
        if (isNaN(dateVal.getTime())) {
          newErrors.finalDeadline = 'Invalid deadline date';
        } else if (dateVal <= new Date()) {
          newErrors.finalDeadline = 'Final deadline must be in the future';
        }
      }
    } else if (step === 3) {
      if (selectedStudentIds.length === 0) {
        newErrors.studentIds = 'Please select at least one student';
      }
    } else if (step === 4) {
      // Client-side due date validation: overridden dates should not be in the past
      for (const override of dueDateOverrides) {
        const overrideDate = new Date(override.dueDate);
        if (overrideDate <= new Date()) {
          newErrors.dueDates =
            'Override due dates must be in the future. Please check checkpoint dates.';
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
      if (res && res.success) {
        navigate({ to: '/instructor/assignments/' + res.assignmentId });
      } else {
        setErrors({ submit: res?.error || 'Failed to create assignment' });
      }
    } catch (err) {
      console.error(err);
      setErrors({ submit: 'A network error occurred. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };
  // Find student details for selected IDs to display in Review step
  const assignedStudents = students.filter((s) => selectedStudentIds.includes(s.id));
  // Step definitions
  const steps = [
    { num: 1, label: t('instructorAssignments.wizard.stepTemplate') },
    { num: 2, label: t('instructorAssignments.wizard.stepDetails') },
    { num: 3, label: t('instructorAssignments.wizard.stepStudents') },
    { num: 4, label: t('instructorAssignments.wizard.stepDueDates') },
    { num: 5, label: t('instructorAssignments.wizard.stepConfirm') },
  ];
  return _jsxs('div', {
    className: 'flex flex-col gap-6 max-w-4xl mx-auto',
    children: [
      _jsxs('div', {
        className: 'relative flex items-center justify-between border-b pb-6 select-none',
        children: [
          _jsx('div', {
            className: 'absolute left-0 right-0 top-1/2 -translate-y-1/2 h-0.5 bg-muted z-0',
          }),
          _jsx('div', {
            className:
              'absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-primary transition-all duration-300 z-0',
            style: { width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` },
          }),
          steps.map((s) => {
            const isCompleted = currentStep > s.num;
            const isActive = currentStep === s.num;
            return _jsxs(
              'div',
              {
                className: 'relative z-10 flex flex-col items-center gap-2',
                children: [
                  _jsx('div', {
                    className: `h-9 w-9 rounded-full flex items-center justify-center border font-bold text-sm shadow-sm transition-all duration-300 ${
                      isCompleted
                        ? 'bg-primary border-primary text-primary-foreground'
                        : isActive
                          ? 'bg-background border-primary text-primary ring-4 ring-primary/10'
                          : 'bg-background border-muted-foreground/30 text-muted-foreground'
                    }`,
                    children: isCompleted ? _jsx(CheckCircle2, { className: 'h-5 w-5' }) : s.num,
                  }),
                  _jsx('span', {
                    className: `hidden md:block text-xs font-semibold tracking-wide uppercase transition-colors ${isActive ? 'text-primary' : 'text-muted-foreground'}`,
                    children: s.label,
                  }),
                ],
              },
              s.num,
            );
          }),
        ],
      }),
      _jsxs('div', {
        className: 'min-h-[300px]',
        children: [
          currentStep === 1 &&
            _jsx(TemplatePicker, {
              selectedTemplateId: selectedTemplate?.id ?? null,
              onSelectTemplate: handleSelectTemplate,
            }),
          currentStep === 2 &&
            _jsx(AssignmentDetailsForm, {
              title: title,
              onChangeTitle: setTitle,
              description: description,
              onChangeDescription: setDescription,
              finalDeadline: finalDeadline,
              onChangeDeadline: setFinalDeadline,
              errors: errors,
            }),
          currentStep === 3 &&
            _jsx(StudentPicker, {
              selectedStudentIds: selectedStudentIds,
              onToggleStudent: handleToggleStudent,
              onSelectAll: handleSelectAllStudents,
              onDeselectAll: () => handleSelectAllStudents([]),
              errors: errors,
            }),
          currentStep === 4 &&
            _jsxs('div', {
              className: 'space-y-4',
              children: [
                _jsx(DueDatePreview, {
                  checkpoints: checkpointDetails,
                  overrides: dueDateOverrides,
                  onOverride: setDueDateOverrides,
                }),
                errors.dueDates &&
                  _jsx('div', {
                    className:
                      'p-3 rounded-lg bg-destructive/10 text-destructive text-sm font-semibold border border-destructive/20',
                    'aria-live': 'polite',
                    'data-testid': 'error-due-dates',
                    children: errors.dueDates,
                  }),
              ],
            }),
          currentStep === 5 &&
            selectedTemplate &&
            _jsx(ReviewStep, {
              title: title,
              description: description,
              finalDeadline: finalDeadline,
              assignedStudents: assignedStudents,
              selectedTemplate: selectedTemplate,
              error: errors.submit,
            }),
        ],
      }),
      _jsxs('div', {
        className: 'flex justify-between items-center border-t pt-4',
        children: [
          _jsxs(Button, {
            type: 'button',
            variant: 'outline',
            onClick:
              currentStep === 1 ? () => navigate({ to: '/instructor/assignments' }) : handlePrev,
            disabled: isSubmitting,
            className: 'font-semibold',
            children: [
              _jsx(ChevronLeft, { className: 'mr-1.5 h-4 w-4' }),
              currentStep === 1 ? t('common.cancel') : t('instructorAssignments.wizard.prev'),
            ],
          }),
          currentStep < steps.length
            ? _jsxs(Button, {
                type: 'button',
                onClick: handleNext,
                className: 'bg-primary hover:bg-primary/95 font-semibold text-primary-foreground',
                children: [
                  t('instructorAssignments.wizard.next'),
                  _jsx(ChevronRight, { className: 'ml-1.5 h-4 w-4' }),
                ],
              })
            : _jsx(Button, {
                type: 'button',
                onClick: handleSubmit,
                disabled: isSubmitting,
                className:
                  'bg-primary hover:bg-primary/95 font-bold text-primary-foreground min-w-[140px]',
                children: isSubmitting
                  ? _jsxs(_Fragment, {
                      children: [
                        _jsx(Loader2, { className: 'mr-2 h-4 w-4 animate-spin' }),
                        t('instructorAssignments.wizard.submitting'),
                      ],
                    })
                  : _jsxs(_Fragment, {
                      children: [
                        t('instructorAssignments.wizard.submit'),
                        _jsx(CheckCircle2, { className: 'ml-2 h-4 w-4' }),
                      ],
                    }),
              }),
        ],
      }),
    ],
  });
}
