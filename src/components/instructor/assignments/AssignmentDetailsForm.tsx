import { useI18n } from '../../../routes/__root';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface AssignmentDetailsFormProps {
  title: string;
  onChangeTitle: (val: string) => void;
  description: string;
  onChangeDescription: (val: string) => void;
  finalDeadline: string; // ISO or date string
  onChangeDeadline: (val: string) => void;
  errors: Record<string, string>;
}

export function AssignmentDetailsForm({
  title,
  onChangeTitle,
  description,
  onChangeDescription,
  finalDeadline,
  onChangeDeadline,
  errors,
}: AssignmentDetailsFormProps) {
  const { t } = useI18n();

  // Get current date+time formatted as YYYY-MM-DDTHH:MM for min value
  const minDateTime = (() => {
    const now = new Date();
    // Add 1 hour just to be safe
    now.setHours(now.getHours() + 1);
    const tzoffset = now.getTimezoneOffset() * 60000; //offset in milliseconds
    const localISOTime = new Date(now.getTime() - tzoffset).toISOString().slice(0, 16);
    return localISOTime;
  })();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          {t('instructorAssignments.wizard.stepDetails')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t('instructorAssignments.wizard.fillDetailsPrompt')}
        </p>
      </div>

      <Card className="p-6 border-border bg-card shadow-sm space-y-5">
        {/* Title Input */}
        <div className="space-y-2">
          <Label htmlFor="assignment-title" className="text-sm font-semibold text-foreground">
            {t('instructorAssignments.wizard.titleLabel')}{' '}
            <span className="text-destructive">*</span>
          </Label>
          <Input
            id="assignment-title"
            placeholder={t('instructorAssignments.wizard.titlePlaceholder')}
            value={title}
            onChange={(e) => onChangeTitle(e.target.value)}
            className={`h-11 ${errors.title ? 'border-destructive focus-visible:ring-destructive' : ''}`}
          />
          {errors.title && (
            <p className="text-xs font-semibold text-destructive mt-1 animate-slide-down">
              {errors.title}
            </p>
          )}
        </div>

        {/* Description Input */}
        <div className="space-y-2">
          <Label htmlFor="assignment-desc" className="text-sm font-semibold text-foreground">
            {t('instructorAssignments.wizard.descriptionLabel')}
          </Label>
          <Textarea
            id="assignment-desc"
            placeholder={t('instructorAssignments.wizard.descriptionPlaceholder')}
            value={description}
            onChange={(e) => onChangeDescription(e.target.value)}
            rows={5}
            className={`resize-y ${errors.description ? 'border-destructive focus-visible:ring-destructive' : ''}`}
            aria-invalid={!!errors.description || undefined}
          />
          {errors.description && (
            <p className="text-xs font-semibold text-destructive mt-1">{errors.description}</p>
          )}
        </div>

        {/* Deadline Input */}
        <div className="space-y-2">
          <Label htmlFor="assignment-deadline" className="text-sm font-semibold text-foreground">
            {t('instructorAssignments.wizard.deadlineLabel')}{' '}
            <span className="text-destructive">*</span>
          </Label>
          <Input
            id="assignment-deadline"
            type="datetime-local"
            min={minDateTime}
            value={finalDeadline}
            onChange={(e) => onChangeDeadline(e.target.value)}
            className={`h-11 ${errors.finalDeadline ? 'border-destructive focus-visible:ring-destructive' : ''}`}
          />
          {errors.finalDeadline && (
            <p className="text-xs font-semibold text-destructive mt-1 animate-slide-down">
              {errors.finalDeadline}
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
