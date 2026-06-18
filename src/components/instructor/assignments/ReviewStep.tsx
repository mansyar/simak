import { useI18n } from '../../../routes/__root';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns/format';
import { BookOpen, Clipboard, Calendar, Users } from 'lucide-react';

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

interface ReviewStepProps {
  title: string;
  description: string;
  finalDeadline: string;
  assignedStudents: Student[];
  selectedTemplate: Template;
  error?: string;
}

export function ReviewStep({
  title,
  description,
  finalDeadline,
  assignedStudents,
  selectedTemplate,
  error,
}: ReviewStepProps) {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          {t('instructorAssignments.wizard.stepConfirm')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t('instructorAssignments.wizard.reviewPrompt')}
        </p>
      </div>

      {error && (
        <div
          className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm font-semibold border border-destructive/20"
          aria-live="polite"
        >
          {error}
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
                {t('instructorAssignments.assignedCohort')}
              </h3>
              <Badge variant="secondary" className="font-bold">
                {t('instructorAssignments.studentsCount', { count: String(assignedStudents.length) })}
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
                    <p className="text-[10px] text-muted-foreground truncate">{student.email}</p>
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
                {t('instructorAssignments.selectedRoadmap')}
              </h4>
              <p className="text-base font-bold text-primary mt-1">{selectedTemplate.name}</p>
              <span className="inline-block text-[10px] font-bold uppercase tracking-wide bg-primary/10 text-primary px-2 py-0.5 rounded-full mt-1.5">
                {selectedTemplate.type}
              </span>
            </div>

            <div className="border-t pt-3 space-y-3">
              <h5 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                {t('instructorAssignments.milestonesSequence')}
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
  );
}
