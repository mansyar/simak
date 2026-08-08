import type { FormEvent } from 'react';
import { useI18n } from '../../../routes/__root';
import type {
  AcademicTermRow,
  CourseRow,
  CourseSectionRow,
  SectionEnrollmentRow,
} from './AcademicContextPage';

export type AcademicEditTarget =
  | { type: 'term'; row: AcademicTermRow }
  | { type: 'course'; row: CourseRow }
  | { type: 'section'; row: CourseSectionRow }
  | { type: 'enrollment'; row: SectionEnrollmentRow };

interface AcademicContextEditFormProps {
  target: AcademicEditTarget;
  onUpdateTerm: (input: {
    id: number;
    code: string;
    name: string;
    startDate: string;
    endDate: string;
    status: AcademicTermRow['status'];
  }) => void | Promise<void>;
  onUpdateCourse: (input: {
    id: number;
    code: string;
    name: string;
    credits: number;
  }) => void | Promise<void>;
  onUpdateSection: (input: {
    id: number;
    termId: number;
    courseId: number;
    code: string;
    name: string;
    status: CourseSectionRow['status'];
  }) => void | Promise<void>;
  onUpdateEnrollment: (input: {
    id: number;
    sectionId: number;
    role: SectionEnrollmentRow['role'];
    isActive: boolean;
  }) => void | Promise<void>;
  onCancel: () => void;
}

export function AcademicContextEditForm({
  target,
  onUpdateTerm,
  onUpdateCourse,
  onUpdateSection,
  onUpdateEnrollment,
  onCancel,
}: AcademicContextEditFormProps) {
  const { t } = useI18n();

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = (name: string) => String(form.get(name) ?? '').trim();

    if (target.type === 'term') {
      await onUpdateTerm({
        id: target.row.id,
        code: value('code'),
        name: value('name'),
        startDate: value('startDate'),
        endDate: value('endDate'),
        status: value('status') as AcademicTermRow['status'],
      });
    } else if (target.type === 'course') {
      await onUpdateCourse({
        id: target.row.id,
        code: value('code'),
        name: value('name'),
        credits: Number(value('credits')),
      });
    } else if (target.type === 'section') {
      await onUpdateSection({
        id: target.row.id,
        termId: Number(value('termId')),
        courseId: Number(value('courseId')),
        code: value('code'),
        name: value('name'),
        status: value('status') as CourseSectionRow['status'],
      });
    } else {
      await onUpdateEnrollment({
        id: target.row.id,
        sectionId: target.row.sectionId,
        role: value('role') as SectionEnrollmentRow['role'],
        isActive: form.get('isActive') === 'on',
      });
    }

    onCancel();
  };

  return (
    <form className="grid gap-4 sm:grid-cols-2" onSubmit={submit}>
      {target.type === 'term' && (
        <>
          <InputField
            name="code"
            label={t('adminAcademicContext.forms.termCode')}
            value={target.row.code}
          />
          <InputField
            name="name"
            label={t('adminAcademicContext.forms.termName')}
            value={target.row.name}
          />
          <InputField
            name="startDate"
            label={t('adminAcademicContext.forms.startsOn')}
            type="date"
            value={target.row.startsOn.slice(0, 10)}
          />
          <InputField
            name="endDate"
            label={t('adminAcademicContext.forms.endsOn')}
            type="date"
            value={target.row.endsOn.slice(0, 10)}
          />
          <StatusField
            name="status"
            label={t('adminAcademicContext.forms.status')}
            value={target.row.status}
            options={['draft', 'active', 'closed']}
          />
        </>
      )}
      {target.type === 'course' && (
        <>
          <InputField
            name="code"
            label={t('adminAcademicContext.forms.courseCode')}
            value={target.row.code}
          />
          <InputField
            name="name"
            label={t('adminAcademicContext.forms.courseName')}
            value={target.row.name}
          />
          <InputField
            name="credits"
            label={t('adminAcademicContext.forms.courseCredits')}
            type="number"
            value={target.row.credits}
          />
        </>
      )}
      {target.type === 'section' && (
        <>
          <InputField
            name="termId"
            label={t('adminAcademicContext.forms.sectionTerm')}
            type="number"
            value={String(target.row.termId)}
          />
          <InputField
            name="courseId"
            label={t('adminAcademicContext.forms.sectionCourse')}
            type="number"
            value={String(target.row.courseId)}
          />
          <InputField
            name="code"
            label={t('adminAcademicContext.forms.sectionCode')}
            value={target.row.code}
          />
          <InputField
            name="name"
            label={t('adminAcademicContext.forms.sectionName')}
            value={target.row.name ?? ''}
            required={false}
          />
          <StatusField
            name="status"
            label={t('adminAcademicContext.forms.status')}
            value={target.row.status}
            options={['active', 'inactive']}
          />
        </>
      )}
      {target.type === 'enrollment' && (
        <>
          <label className="grid gap-1.5 text-sm font-medium text-foreground">
            {t('adminAcademicContext.forms.enrollmentRole')}
            <select
              name="role"
              defaultValue={target.row.role}
              className="h-10 rounded-md border bg-background px-3"
            >
              <option value="student">{t('adminAcademicContext.roles.student')}</option>
              <option value="instructor">{t('adminAcademicContext.roles.instructor')}</option>
            </select>
          </label>
          <label className="flex items-center gap-2 self-end text-sm font-medium text-foreground">
            <input name="isActive" type="checkbox" defaultChecked={target.row.isActive} />
            {t('adminAcademicContext.forms.active')}
          </label>
        </>
      )}
      <div className="flex items-end gap-2 sm:col-span-2">
        <button
          type="submit"
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          {t('adminAcademicContext.forms.submit')}
        </button>
        <button
          type="button"
          className="inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium hover:bg-muted"
          onClick={onCancel}
        >
          {t('adminAcademicContext.forms.cancel')}
        </button>
      </div>
    </form>
  );
}

function InputField({
  name,
  label,
  type = 'text',
  value,
  required = true,
}: {
  name: string;
  label: string;
  type?: string;
  value: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-foreground">
      {label}
      <input
        name={name}
        type={type}
        defaultValue={value}
        required={required}
        className="h-10 rounded-md border bg-background px-3"
      />
    </label>
  );
}

function StatusField({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value: string;
  options: string[];
}) {
  const { t } = useI18n();
  return (
    <label className="grid gap-1.5 text-sm font-medium text-foreground">
      {label}
      <select
        name={name}
        defaultValue={value}
        className="h-10 rounded-md border bg-background px-3"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {t(`adminAcademicContext.status.${option}` as never)}
          </option>
        ))}
      </select>
    </label>
  );
}
