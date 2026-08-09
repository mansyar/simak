import {
  REPORT_JOB_STATES,
  REPORT_LOCALES,
  REPORT_TYPES,
  calculateReportExpiry,
  getAvailableReportTypes,
  normalizeReportFilters,
} from '@/lib/reporting-policy';

describe('reporting policy', () => {
  it('defines the bounded report, locale, and job-state contracts', () => {
    expect(REPORT_TYPES).toEqual([
      'institutional_academic_summary',
      'official_transcript',
      'analytics_summary',
    ]);
    expect(REPORT_LOCALES).toEqual(['en', 'id']);
    expect(REPORT_JOB_STATES).toEqual(['pending', 'processing', 'completed', 'failed', 'expired']);
  });

  it.each([
    ['superadmin', ['institutional_academic_summary', 'official_transcript', 'analytics_summary']],
    ['admin', ['institutional_academic_summary', 'official_transcript', 'analytics_summary']],
    ['instructor', ['analytics_summary']],
    ['student', ['official_transcript']],
  ] as const)('returns the allowlisted reports for %s', (role, expected) => {
    expect(getAvailableReportTypes(role)).toEqual(expected);
  });

  it('normalizes optional report filters into an auditable stable shape', () => {
    expect(
      normalizeReportFilters({
        termId: 3,
        courseId: undefined,
        sectionId: null,
        cohort: '  2026  ',
      }),
    ).toEqual({
      termId: 3,
      courseId: null,
      sectionId: null,
      cohort: '2026',
    });
  });

  it('rejects invalid filter identifiers and blank cohorts', () => {
    expect(() => normalizeReportFilters({ termId: 0 })).toThrow('termId');
    expect(() => normalizeReportFilters({ courseId: 1.5 })).toThrow('courseId');
    expect(() => normalizeReportFilters({ cohort: '  ' })).toThrow('cohort');
  });

  it('calculates expiry exactly 30 days after successful generation', () => {
    expect(calculateReportExpiry(new Date('2026-08-09T11:30:00.000Z'))).toEqual(
      new Date('2026-09-08T11:30:00.000Z'),
    );
  });

  it('rejects an invalid completion timestamp', () => {
    expect(() => calculateReportExpiry(new Date(Number.NaN))).toThrow('completion timestamp');
  });
});
