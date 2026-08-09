export const REPORT_TYPES = [
  'institutional_academic_summary',
  'official_transcript',
  'analytics_summary',
] as const;

export const REPORT_LOCALES = ['en', 'id'] as const;

export const REPORT_JOB_STATES = [
  'pending',
  'processing',
  'completed',
  'failed',
  'expired',
] as const;

export type ReportType = (typeof REPORT_TYPES)[number];
export type ReportLocale = (typeof REPORT_LOCALES)[number];
export type ReportJobState = (typeof REPORT_JOB_STATES)[number];
export type ReportingRole = 'superadmin' | 'admin' | 'instructor' | 'student';

export type ReportFilters = {
  termId?: number | null;
  courseId?: number | null;
  sectionId?: number | null;
  cohort?: string | null;
};

export type NormalizedReportFilters = {
  termId: number | null;
  courseId: number | null;
  sectionId: number | null;
  cohort: string | null;
};

export type ReportJobParameters = NormalizedReportFilters & {
  studentId?: string;
};

const ADMIN_REPORT_TYPES: readonly ReportType[] = REPORT_TYPES;
const REPORT_TYPES_BY_ROLE: Record<ReportingRole, readonly ReportType[]> = {
  superadmin: ADMIN_REPORT_TYPES,
  admin: ADMIN_REPORT_TYPES,
  instructor: ['analytics_summary'],
  student: ['official_transcript'],
};

const REPORT_RETENTION_DAYS = 30;
const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1_000;

export function getAvailableReportTypes(role: ReportingRole): readonly ReportType[] {
  return REPORT_TYPES_BY_ROLE[role];
}

export function normalizeReportFilters(filters: ReportFilters): NormalizedReportFilters {
  return {
    termId: normalizeId(filters.termId, 'termId'),
    courseId: normalizeId(filters.courseId, 'courseId'),
    sectionId: normalizeId(filters.sectionId, 'sectionId'),
    cohort: normalizeCohort(filters.cohort),
  };
}

export function calculateReportExpiry(completedAt: Date): Date {
  const timestamp = completedAt.getTime();
  if (!Number.isFinite(timestamp)) {
    throw new Error('Report completion timestamp is invalid');
  }

  return new Date(timestamp + REPORT_RETENTION_DAYS * DAY_IN_MILLISECONDS);
}

function normalizeId(value: number | null | undefined, field: string): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${field} must be a positive integer`);
  }
  return value;
}

function normalizeCohort(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const cohort = value.trim();
  if (!cohort) throw new Error('cohort must not be blank');
  return cohort;
}
