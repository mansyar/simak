import { useState, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useI18n } from '../../../routes/__root';
import { createAssignment } from '@/server/assignments';
import { listUsers } from '@/server/users';
import { TemplatePicker } from './TemplatePicker';
import { AssignmentDetailsForm } from './AssignmentDetailsForm';
import { StudentPicker } from './StudentPicker';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import {
  Clipboard,
  Calendar,
  Users,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  BookOpen,
} from 'lucide-react';

interface Student {
  id: string;
  name: string;
  email: string;
}

interface Template {
  id: number;
  name: string;
  type: string;
  checkpoints: string[];
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

  // List of all students for lookup in final review step
  const [students, setStudents] = useState<Student[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    // Load student list so we have their names/emails for the summary screen
    async function loadStudents() {
      try {
        const response = await (listUsers as any)({
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

  const handleSelectTemplate = (tpl: Template) => {
    setSelectedTemplate(tpl);
    // Suggest a default title if not set
    if (!title) {
      setTitle(`${tpl.name} - Cohort ${new Date().getFullYear()}`);
    }
    setErrors((prev) => ({ ...prev, templateId: '' }));
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
    if (!validateStep(1) || !validateStep(2) || !validateStep(3)) {
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await (createAssignment as any)({
        data: {
          templateId: selectedTemplate?.id,
          title,
          description,
          finalDeadline: new Date(finalDeadline).toISOString(),
          studentIds: selectedStudentIds,
        },
      });

      if (res && res.success) {
        navigate({ to: ('/instructor/assignments/' + res.assignmentId) as any });
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
    { num: 4, label: t('instructorAssignments.wizard.stepConfirm') },
  ];

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto">
      {/* Wizard Header Progress Bar */}
      <div className="relative flex items-center justify-between border-b pb-6 select-none">
        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-0.5 bg-muted z-0" />
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-primary transition-all duration-300 z-0"
          style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
        />

        {steps.map((s) => {
          const isCompleted = currentStep > s.num;
          const isActive = currentStep === s.num;
          return (
            <div key={s.num} className="relative z-10 flex flex-col items-center gap-2">
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

      {/* Step Components */}
      <div className="min-h-[300px]">
        {currentStep === 1 && (
          <TemplatePicker
            selectedTemplateId={selectedTemplate?.id ?? null}
            onSelectTemplate={handleSelectTemplate}
          />
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

        {currentStep === 4 && selectedTemplate && (
          <div className="space-y-6">
            <div className="flex flex-col gap-2">
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                {t('instructorAssignments.wizard.stepConfirm')}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t('instructorAssignments.wizard.reviewPrompt')}
              </p>
            </div>

            {errors.submit && (
              <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm font-semibold border border-destructive/20">
                {errors.submit}
              </div>
            )}

            <div className="grid gap-6 md:grid-cols-3">
              {/* Left Details Block */}
              <div className="md:col-span-2 space-y-4">
                <Card className="p-5 border-border bg-card shadow-sm space-y-4">
                  <div className="flex items-start gap-3">
                    <BookOpen className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                        {t('instructorAssignments.wizard.titleLabel')}
                      </h4>
                      <p className="text-lg font-bold text-foreground mt-0.5">{title}</p>
                    </div>
                  </div>

                  {description && (
                    <div className="border-t pt-3 flex items-start gap-3">
                      <Clipboard className="h-5 w-5 text-primary mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                          {t('instructorAssignments.details.description')}
                        </h4>
                        <p className="text-sm text-muted-foreground mt-1 whitespace-pre-line leading-relaxed">
                          {description}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="border-t pt-3 flex items-start gap-3">
                    <Calendar className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                        {t('instructorAssignments.details.deadline')}
                      </h4>
                      <p className="text-sm font-bold text-foreground mt-0.5">
                        {format(new Date(finalDeadline), 'MMMM d, yyyy h:mm a')}
                      </p>
                    </div>
                  </div>
                </Card>

                {/* Assigned Students Summary */}
                <Card className="p-5 border-border bg-card shadow-sm space-y-3">
                  <div className="flex items-center justify-between border-b pb-2">
                    <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Users className="h-4 w-4 text-primary" />
                      Assigned Cohort
                    </h3>
                    <Badge variant="secondary" className="font-bold">
                      {assignedStudents.length} Students
                    </Badge>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 max-h-[160px] overflow-y-auto pr-1">
                    {assignedStudents.map((student) => (
                      <div
                        key={student.id}
                        className="flex items-center gap-2 p-2 rounded-lg border bg-accent/20 text-xs"
                      >
                        <div className="h-6 w-6 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center">
                          {student.name[0].toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-foreground truncate">{student.name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {student.email}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>

              {/* Right Template Milestones Info */}
              <div className="space-y-4">
                <Card className="p-5 border-primary/20 bg-gradient-to-br from-card to-accent/10 space-y-4">
                  <div>
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Selected Roadmap
                    </h4>
                    <p className="text-base font-bold text-primary mt-1">{selectedTemplate.name}</p>
                    <span className="inline-block text-[10px] font-bold uppercase tracking-wide bg-primary/10 text-primary px-2 py-0.5 rounded-full mt-1.5">
                      {selectedTemplate.type}
                    </span>
                  </div>

                  <div className="border-t pt-3 space-y-3">
                    <h5 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Milestones Sequence
                    </h5>
                    <div className="relative pl-4 space-y-3.5 before:absolute before:left-1.5 before:top-1.5 before:bottom-1.5 before:w-0.5 before:bg-primary/20">
                      {selectedTemplate.checkpoints.map((cp, idx) => (
                        <div key={idx} className="relative flex items-center gap-2 text-xs">
                          <div
                            className={`absolute -left-4 flex h-3 w-3 items-center justify-center rounded-full border text-[8px] font-bold ${
                              idx === 0
                                ? 'bg-primary border-primary text-primary-foreground'
                                : 'bg-background border-muted-foreground/30 text-muted-foreground'
                            }`}
                          >
                            {idx + 1}
                          </div>
                          <span
                            className={`font-semibold ${idx === 0 ? 'text-primary' : 'text-foreground'}`}
                          >
                            {cp}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Control Buttons */}
      <div className="flex justify-between items-center border-t pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={
            currentStep === 1
              ? () => navigate({ to: '/instructor/assignments' as any })
              : handlePrev
          }
          disabled={isSubmitting}
          className="font-semibold"
        >
          <ChevronLeft className="mr-1.5 h-4 w-4" />
          {currentStep === 1 ? t('common.cancel' as any) : t('instructorAssignments.wizard.prev')}
        </Button>

        {currentStep < steps.length ? (
          <Button
            type="button"
            onClick={handleNext}
            className="bg-primary hover:bg-primary/95 font-semibold text-primary-foreground"
          >
            {t('instructorAssignments.wizard.next')}
            <ChevronRight className="ml-1.5 h-4 w-4" />
          </Button>
        ) : (
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="bg-primary hover:bg-primary/95 font-bold text-primary-foreground min-w-[140px]"
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
