import type {
  NormalizedReportFilters,
  ReportLocale,
  ReportType,
  ReportingRole,
} from '@/lib/reporting-policy';

export type CatalogFilterTerm = { id: number; code: string; name: string };
export type CatalogFilterCourse = { id: number; code: string; name: string };
export type CatalogFilterSection = {
  id: number;
  code: string;
  name: string | null;
  cohort: string | null;
  termId: number;
  courseId: number;
};

export type CatalogFilterOptions = {
  terms: CatalogFilterTerm[];
  courses: CatalogFilterCourse[];
  sections: CatalogFilterSection[];
  cohorts: string[];
};

export type SelectedReportFilters = NormalizedReportFilters;

export type ReportRequest = {
  data: {
    reportType: ReportType;
    locale: ReportLocale;
    filters: NormalizedReportFilters;
    studentId?: string;
  };
};

export function deriveCourseOptions(
  options: CatalogFilterOptions,
  termId: number | null,
): CatalogFilterCourse[] {
  if (termId === null) return options.courses;
  const courseIds = new Set(
    options.sections
      .filter((section) => section.termId === termId)
      .map((section) => section.courseId),
  );
  return options.courses.filter((course) => courseIds.has(course.id));
}

export function deriveSectionOptions(
  options: CatalogFilterOptions,
  termId: number | null,
  courseId: number | null,
): CatalogFilterSection[] {
  return options.sections.filter((section) => {
    if (termId !== null && section.termId !== termId) return false;
    if (courseId !== null && section.courseId !== courseId) return false;
    return true;
  });
}

export function deriveCohortOptions(
  options: CatalogFilterOptions,
  termId: number | null,
  courseId: number | null,
  sectionId: number | null,
): string[] {
  if (sectionId !== null) {
    const section = options.sections.find((candidate) => candidate.id === sectionId);
    return section?.cohort ? [section.cohort] : [];
  }

  const cohorts: string[] = [];
  for (const section of deriveSectionOptions(options, termId, courseId)) {
    if (section.cohort && !cohorts.includes(section.cohort)) cohorts.push(section.cohort);
  }
  return cohorts;
}

export function buildReportRequest(
  reportType: ReportType,
  role: ReportingRole,
  locale: ReportLocale,
  filters: NormalizedReportFilters,
  studentId: string | null,
): ReportRequest {
  const requiresStudent = role !== 'student' && reportType === 'official_transcript';
  return {
    data: {
      reportType,
      locale,
      filters,
      ...(requiresStudent && studentId ? { studentId } : {}),
    },
  };
}
