import { useState, type FormEvent, type ReactNode } from 'react';
import { useI18n } from '../../../routes/__root';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type TermStatus = 'draft' | 'active' | 'closed' | 'archived';
type SectionStatus = 'active' | 'inactive' | 'archived';
type EnrollmentRole = 'instructor' | 'student';

export interface AcademicTermRow {
  id: number;
  code: string;
  name: string;
  startsOn: string;
  endsOn: string;
  status: TermStatus;
}

export interface CourseRow {
  id: number;
  code: string;
  name: string;
  status?: string;
}

export interface CourseSectionRow {
  id: number;
  code: string;
  name: string | null;
  termId: number;
  courseId: number;
  status: SectionStatus;
}

export interface SectionEnrollmentRow {
  id: number;
  sectionId: number;
  userId: string;
  userName: string;
  role: EnrollmentRole;
  isActive: boolean;
}

export type AcademicArchiveTarget =
  | { type: 'term'; id: number }
  | { type: 'course'; id: number }
  | { type: 'section'; id: number };

interface AcademicContextPageProps {
  terms: AcademicTermRow[];
  courses: CourseRow[];
  sections: CourseSectionRow[];
  enrollments: SectionEnrollmentRow[];
  loading: boolean;
  error: { code: string; message: string } | null;
  onCreateTerm?: (input: {
    code: string;
    name: string;
    startDate: string;
    endDate: string;
  }) => void | Promise<void>;
  onCreateCourse?: (input: { code: string; name: string }) => void | Promise<void>;
  onCreateSection?: (input: {
    termId: number;
    courseId: number;
    code: string;
    name: string;
  }) => void | Promise<void>;
  onAddEnrollment?: (input: {
    sectionId: number;
    userId: string;
    role: EnrollmentRole;
  }) => void | Promise<void>;
  onArchive?: (target: AcademicArchiveTarget) => void | Promise<void>;
}

type FormKind = 'term' | 'course' | 'section' | 'enrollment' | null;

export function AcademicContextPage({
  terms,
  courses,
  sections,
  enrollments,
  loading,
  error,
  onCreateTerm,
  onCreateCourse,
  onCreateSection,
  onAddEnrollment,
  onArchive,
}: AcademicContextPageProps) {
  const { t } = useI18n();
  const [openForm, setOpenForm] = useState<FormKind>(null);

  const statusLabel = (status: TermStatus | SectionStatus) => {
    const labels: Record<TermStatus | SectionStatus, string> = {
      draft: t('adminAcademicContext.status.draft'),
      active: t('adminAcademicContext.status.active'),
      closed: t('adminAcademicContext.status.closed'),
      inactive: t('adminAcademicContext.status.inactive'),
      archived: t('adminAcademicContext.status.archived'),
    };
    return labels[status];
  };

  const archive = (target: AcademicArchiveTarget) => {
    if (window.confirm(t('adminAcademicContext.archiveConfirm'))) {
      void onArchive?.(target);
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>, kind: Exclude<FormKind, null>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = (name: string) => String(form.get(name) ?? '').trim();

    if (kind === 'term') {
      void onCreateTerm?.({
        code: value('code'),
        name: value('name'),
        startDate: value('startDate'),
        endDate: value('endDate'),
      });
    } else if (kind === 'course') {
      void onCreateCourse?.({ code: value('code'), name: value('name') });
    } else if (kind === 'section') {
      void onCreateSection?.({
        termId: Number(value('termId')),
        courseId: Number(value('courseId')),
        code: value('code'),
        name: value('name'),
      });
    } else {
      void onAddEnrollment?.({
        sectionId: Number(value('sectionId')),
        userId: value('userId'),
        role: value('role') as EnrollmentRole,
      });
    }

    setOpenForm(null);
  };

  if (loading) {
    return (
      <div className="flex min-h-40 items-center justify-center" role="status" aria-live="polite">
        <span className="sr-only">{t('common.loading')}</span>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm"
        role="alert"
      >
        {t('errors.fetchFailed')}
      </div>
    );
  }

  const isEmpty =
    terms.length === 0 && courses.length === 0 && sections.length === 0 && enrollments.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">
            {t('adminAcademicContext.title')}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
            {t('adminAcademicContext.title')}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => setOpenForm('term')}>
            {t('adminAcademicContext.actions.createTerm')}
          </Button>
          <Button type="button" variant="outline" onClick={() => setOpenForm('course')}>
            {t('adminAcademicContext.actions.createCourse')}
          </Button>
          <Button type="button" variant="outline" onClick={() => setOpenForm('section')}>
            {t('adminAcademicContext.actions.createSection')}
          </Button>
          <Button type="button" onClick={() => setOpenForm('enrollment')}>
            {t('adminAcademicContext.actions.addEnrollment')}
          </Button>
        </div>
      </div>

      {openForm && (
        <Card>
          <CardHeader>
            <CardTitle>
              {t(
                `adminAcademicContext.actions.create${openForm[0].toUpperCase()}${openForm.slice(1)}` as never,
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={(event) => submit(event, openForm)}
            >
              {openForm === 'term' && (
                <>
                  <Field name="code" label={t('adminAcademicContext.forms.termCode')} required />
                  <Field name="name" label={t('adminAcademicContext.forms.termName')} required />
                  <Field
                    name="startDate"
                    label={t('adminAcademicContext.forms.startsOn')}
                    type="date"
                    required
                  />
                  <Field
                    name="endDate"
                    label={t('adminAcademicContext.forms.endsOn')}
                    type="date"
                    required
                  />
                </>
              )}
              {openForm === 'course' && (
                <>
                  <Field name="code" label={t('adminAcademicContext.forms.courseCode')} required />
                  <Field name="name" label={t('adminAcademicContext.forms.courseName')} required />
                </>
              )}
              {openForm === 'section' && (
                <>
                  <Field
                    name="termId"
                    label={t('adminAcademicContext.forms.sectionTerm')}
                    type="number"
                    required
                  />
                  <Field
                    name="courseId"
                    label={t('adminAcademicContext.forms.sectionCourse')}
                    type="number"
                    required
                  />
                  <Field name="code" label={t('adminAcademicContext.forms.sectionCode')} required />
                  <Field name="name" label={t('adminAcademicContext.forms.sectionName')} required />
                </>
              )}
              {openForm === 'enrollment' && (
                <>
                  <Field
                    name="sectionId"
                    label={t('adminAcademicContext.forms.enrollmentSection')}
                    type="number"
                    required
                  />
                  <Field
                    name="userId"
                    label={t('adminAcademicContext.forms.enrollmentUser')}
                    required
                  />
                  <label className="grid gap-1.5 text-sm font-medium text-foreground">
                    {t('adminAcademicContext.forms.enrollmentRole')}
                    <select
                      name="role"
                      defaultValue="student"
                      className="h-10 rounded-md border bg-background px-3"
                    >
                      <option value="student">{t('adminAcademicContext.roles.student')}</option>
                      <option value="instructor">
                        {t('adminAcademicContext.roles.instructor')}
                      </option>
                    </select>
                  </label>
                </>
              )}
              <div className="flex items-end gap-2 sm:col-span-2">
                <Button type="submit">{t('adminAcademicContext.forms.submit')}</Button>
                <Button type="button" variant="ghost" onClick={() => setOpenForm(null)}>
                  {t('adminAcademicContext.forms.cancel')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {isEmpty && (
        <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          {t('adminAcademicContext.empty')}
        </p>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <CollectionCard title={t('adminAcademicContext.terms')}>
          {terms.map((term) => (
            <CollectionRow
              key={term.id}
              label={
                <>
                  <span>{term.code}</span>
                  <span aria-hidden="true"> · </span>
                  <span>{term.name}</span>
                </>
              }
              status={statusLabel(term.status)}
              onArchive={() => archive({ type: 'term', id: term.id })}
            />
          ))}
        </CollectionCard>
        <CollectionCard title={t('adminAcademicContext.courses')}>
          {courses.map((course) => (
            <CollectionRow
              key={course.id}
              label={
                <>
                  <span>{course.code}</span>
                  <span aria-hidden="true"> · </span>
                  <span>{course.name}</span>
                </>
              }
              onArchive={() => archive({ type: 'course', id: course.id })}
            />
          ))}
        </CollectionCard>
        <CollectionCard title={t('adminAcademicContext.sections')}>
          {sections.map((section) => (
            <CollectionRow
              key={section.id}
              label={
                <>
                  <span>{section.code}</span>
                  {section.name && (
                    <>
                      <span aria-hidden="true"> · </span>
                      <span>{section.name}</span>
                    </>
                  )}
                </>
              }
              status={statusLabel(section.status)}
              onArchive={() => archive({ type: 'section', id: section.id })}
            />
          ))}
        </CollectionCard>
        <CollectionCard title={t('adminAcademicContext.enrollments')}>
          {enrollments.map((enrollment) => (
            <div
              key={enrollment.id}
              className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm"
            >
              <span className="min-w-0 truncate">{enrollment.userName}</span>
              <Badge variant={enrollment.isActive ? 'secondary' : 'outline'}>
                {enrollment.role}
              </Badge>
            </div>
          ))}
        </CollectionCard>
      </div>
    </div>
  );
}

function Field({
  name,
  label,
  type = 'text',
  required = false,
}: {
  name: string;
  label: ReactNode;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-foreground">
      {label}
      <input
        name={name}
        type={type}
        required={required}
        className="h-10 rounded-md border bg-background px-3"
      />
    </label>
  );
}

function CollectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">{children}</CardContent>
    </Card>
  );
}

function CollectionRow({
  label,
  status,
  onArchive,
}: {
  label: ReactNode;
  status?: string;
  onArchive: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
      <span className="min-w-0 truncate font-medium">{label}</span>
      <div className="flex shrink-0 items-center gap-2">
        {status && <Badge variant="outline">{status}</Badge>}
        <Button type="button" variant="ghost" size="sm" onClick={onArchive}>
          {t('adminAcademicContext.actions.archive')}
        </Button>
      </div>
    </div>
  );
}
