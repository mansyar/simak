import { useI18n } from '../../../routes/__root';
import { Button } from '@/components/ui/button';

type AssignmentMode = 'individual' | 'group';
type AssignmentStatus = 'draft' | 'active' | 'archived';

export interface AssignmentSectionOption {
  id: number;
  label: string;
  termId: number;
  courseId: number;
  status: 'active' | 'inactive' | 'archived';
  students?: AssignmentStudentOption[];
}

export interface AssignmentStudentOption {
  id: string;
  name: string;
  email: string;
}

interface AssignmentContextControlsProps {
  sections: AssignmentSectionOption[];
  students: AssignmentStudentOption[];
  selectedSectionId: number | null;
  selectedStudentIds: string[];
  mode: AssignmentMode;
  status: AssignmentStatus;
  onSectionChange: (sectionId: number) => void;
  onStudentChange: (studentIds: string[]) => void;
  onModeChange: (mode: AssignmentMode) => void;
  onStatusChange: (status: AssignmentStatus) => void;
  onClone: () => void;
  onRollover: () => void;
  showLifecycleControls?: boolean;
  showCloneActions?: boolean;
}

export function AssignmentContextControls({
  sections,
  students,
  selectedSectionId,
  selectedStudentIds,
  mode,
  status,
  onSectionChange,
  onStudentChange,
  onModeChange,
  onStatusChange,
  onClone,
  onRollover,
  showLifecycleControls = true,
  showCloneActions = true,
}: AssignmentContextControlsProps) {
  const { t } = useI18n();
  const selectedSection = sections.find((section) => section.id === selectedSectionId);
  const availableStudents = selectedSection?.students ?? students;

  return (
    <fieldset className="space-y-4 rounded-xl border bg-card p-4">
      <legend className="px-1 text-sm font-semibold text-foreground">
        {t('instructorAssignments.context.section')}
      </legend>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-medium text-foreground">
          {t('instructorAssignments.context.section')}
          <select
            aria-label={t('instructorAssignments.context.section')}
            value={selectedSectionId ?? ''}
            onChange={(event) => onSectionChange(Number(event.target.value))}
            className="h-10 rounded-md border bg-background px-3"
          >
            <option value="" disabled>
              {t('instructorAssignments.context.selectSection')}
            </option>
            {sections.map((section) => (
              <option key={section.id} value={section.id} disabled={section.status !== 'active'}>
                {section.label}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1.5 text-sm font-medium text-foreground">
          {t('instructorAssignments.context.students')}
          <select
            aria-label={t('instructorAssignments.context.students')}
            multiple
            value={selectedStudentIds}
            onChange={(event) =>
              onStudentChange(Array.from(event.target.selectedOptions, (option) => option.value))
            }
            className="min-h-24 rounded-md border bg-background px-3 py-2"
          >
            {availableStudents.map((student) => (
              <option key={student.id} value={student.id}>
                {student.name} · {student.email}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1.5 text-sm font-medium text-foreground">
          {t('instructorAssignments.context.mode')}
          <select
            aria-label={t('instructorAssignments.context.mode')}
            value={mode}
            onChange={(event) => onModeChange(event.target.value as AssignmentMode)}
            className="h-10 rounded-md border bg-background px-3"
          >
            <option value="individual">{t('instructorAssignments.mode.individual')}</option>
            <option value="group" disabled>
              {t('instructorAssignments.mode.group')}
            </option>
          </select>
        </label>

        {showLifecycleControls && (
          <label className="grid gap-1.5 text-sm font-medium text-foreground">
            {t('instructorAssignments.context.status')}
            <select
              aria-label={t('instructorAssignments.context.status')}
              value={status}
              onChange={(event) => onStatusChange(event.target.value as AssignmentStatus)}
              className="h-10 rounded-md border bg-background px-3"
            >
              <option value="draft">{t('instructorAssignments.status.draft')}</option>
              <option value="active">{t('instructorAssignments.status.active')}</option>
              <option value="archived">{t('instructorAssignments.status.archived')}</option>
            </select>
          </label>
        )}
      </div>

      {showCloneActions && (
        <div className="flex flex-wrap gap-2 border-t pt-4">
          <Button type="button" variant="outline" onClick={onClone}>
            {t('instructorAssignments.actions.clone')}
          </Button>
          <Button type="button" variant="outline" onClick={onRollover}>
            {t('instructorAssignments.actions.rollover')}
          </Button>
        </div>
      )}
    </fieldset>
  );
}
