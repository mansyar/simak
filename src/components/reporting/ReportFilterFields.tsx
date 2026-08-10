import { useId, useMemo } from 'react';
import { useI18n } from '@/routes/__root';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import type { TranslationKey } from '@/i18n/index';
import {
  deriveCohortOptions,
  deriveCourseOptions,
  deriveSectionOptions,
  type CatalogFilterCourse,
  type CatalogFilterOptions,
  type CatalogFilterSection,
  type SelectedReportFilters,
} from '@/lib/reporting-options';

type ReportFilterFieldsProps = {
  options: CatalogFilterOptions;
  filters: SelectedReportFilters;
  onChange: (filters: SelectedReportFilters) => void;
};

function sectionLabel(section: CatalogFilterSection, courses: CatalogFilterCourse[]): string {
  const course = courses.find((candidate) => candidate.id === section.courseId);
  const name = section.name ? ` - ${section.name}` : '';
  return `${course?.code ?? '—'} - ${section.code}${name}`;
}

function FilterField({
  id,
  labelKey,
  display,
  value,
  onValueChange,
  note,
  children,
}: {
  id: string;
  labelKey: TranslationKey;
  display: string;
  value: string;
  onValueChange: (value: string | null) => void;
  note?: string;
  children: React.ReactNode;
}) {
  const { t } = useI18n();

  return (
    <div className="grid gap-1 text-sm font-medium">
      <span id={`report-${id}-label`}>{t(labelKey)}</span>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger
          aria-labelledby={`report-${id}-label`}
          aria-label={t(labelKey)}
          className="min-h-11 min-w-52 focus-visible:ring-2"
        >
          {display}
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

export function ReportFilterFields({ options, filters, onChange }: ReportFilterFieldsProps) {
  const { t } = useI18n();
  const baseId = useId();

  const courseOptions = useMemo(
    () => deriveCourseOptions(options, filters.termId),
    [options, filters.termId],
  );
  const sectionOptions = useMemo(
    () => deriveSectionOptions(options, filters.termId, filters.courseId),
    [options, filters.termId, filters.courseId],
  );
  const cohortOptions = useMemo(
    () => deriveCohortOptions(options, filters.termId, filters.courseId, filters.sectionId),
    [options, filters.termId, filters.courseId, filters.sectionId],
  );

  const selectedTerm = options.terms.find((term) => term.id === filters.termId);
  const selectedCourse = options.courses.find((course) => course.id === filters.courseId);
  const selectedSection = options.sections.find((section) => section.id === filters.sectionId);

  const handleTermChange = (value: string | null) => {
    onChange({
      ...filters,
      termId: value === 'all' || !value ? null : Number(value),
      courseId: null,
      sectionId: null,
      cohort: null,
    });
  };

  const handleCourseChange = (value: string | null) => {
    onChange({
      ...filters,
      courseId: value === 'all' || !value ? null : Number(value),
      sectionId: null,
      cohort: null,
    });
  };

  const handleSectionChange = (value: string | null) => {
    onChange({
      ...filters,
      sectionId: value === 'all' || !value ? null : Number(value),
      cohort: null,
    });
  };

  const handleCohortChange = (value: string | null) => {
    onChange({ ...filters, cohort: value === 'all' || !value ? null : value });
  };

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-semibold">{t('reports.filters.label')}</legend>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <FilterField
          id={`${baseId}-term`}
          labelKey="reports.filters.term"
          value={filters.termId === null ? 'all' : String(filters.termId)}
          onValueChange={handleTermChange}
          display={selectedTerm ? selectedTerm.name : t('reports.filters.allTerms')}
        >
          <SelectItem value="all">{t('reports.filters.allTerms')}</SelectItem>
          {options.terms.map((term) => (
            <SelectItem key={term.id} value={String(term.id)}>
              {term.name}
            </SelectItem>
          ))}
        </FilterField>

        <FilterField
          id={`${baseId}-course`}
          labelKey="reports.filters.course"
          value={filters.courseId === null ? 'all' : String(filters.courseId)}
          onValueChange={handleCourseChange}
          display={
            selectedCourse
              ? `${selectedCourse.code} - ${selectedCourse.name}`
              : t('reports.filters.allCourses')
          }
          note={courseOptions.length === 0 ? t('reports.filters.noCourses') : undefined}
        >
          <SelectItem value="all">{t('reports.filters.allCourses')}</SelectItem>
          {courseOptions.map((course) => (
            <SelectItem key={course.id} value={String(course.id)}>
              {course.code} - {course.name}
            </SelectItem>
          ))}
        </FilterField>

        <FilterField
          id={`${baseId}-section`}
          labelKey="reports.filters.section"
          value={filters.sectionId === null ? 'all' : String(filters.sectionId)}
          onValueChange={handleSectionChange}
          display={
            selectedSection
              ? sectionLabel(selectedSection, options.courses)
              : t('reports.filters.allSections')
          }
          note={sectionOptions.length === 0 ? t('reports.filters.noSections') : undefined}
        >
          <SelectItem value="all">{t('reports.filters.allSections')}</SelectItem>
          {sectionOptions.map((section) => (
            <SelectItem key={section.id} value={String(section.id)}>
              {sectionLabel(section, options.courses)}
            </SelectItem>
          ))}
        </FilterField>

        <FilterField
          id={`${baseId}-cohort`}
          labelKey="reports.filters.cohort"
          value={filters.cohort === null ? 'all' : filters.cohort}
          onValueChange={handleCohortChange}
          display={filters.cohort ?? t('reports.filters.allCohorts')}
          note={cohortOptions.length === 0 ? t('reports.filters.noCohorts') : undefined}
        >
          <SelectItem value="all">{t('reports.filters.allCohorts')}</SelectItem>
          {cohortOptions.map((cohort) => (
            <SelectItem key={cohort} value={cohort}>
              {cohort}
            </SelectItem>
          ))}
        </FilterField>
      </div>
    </fieldset>
  );
}
