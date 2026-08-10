import { describe, expect, it } from 'vitest';
import {
  buildReportRequest,
  deriveCohortOptions,
  deriveCourseOptions,
  deriveSectionOptions,
  type CatalogFilterOptions,
} from '@/lib/reporting-options';

const options: CatalogFilterOptions = {
  terms: [
    { id: 1, code: '2026-FALL', name: 'Fall 2026' },
    { id: 2, code: '2026-SPRING', name: 'Spring 2026' },
  ],
  courses: [
    { id: 10, code: 'IF101', name: 'Algorithms' },
    { id: 20, code: 'IF201', name: 'Databases' },
  ],
  sections: [
    { id: 100, code: 'A', name: 'Morning', cohort: '2026', termId: 1, courseId: 10 },
    { id: 101, code: 'B', name: 'Evening', cohort: '2026', termId: 1, courseId: 10 },
    { id: 102, code: 'C', name: 'Weekend', cohort: '2027', termId: 1, courseId: 20 },
    { id: 103, code: 'A', name: 'Morning', cohort: '2027', termId: 2, courseId: 10 },
  ],
  cohorts: ['2026', '2027'],
};

const emptyFilters = { termId: null, courseId: null, sectionId: null, cohort: null };

describe('reporting options', () => {
  describe('deriveCourseOptions', () => {
    it('returns all courses when no term is selected', () => {
      expect(deriveCourseOptions(options, null)).toEqual(options.courses);
    });

    it('returns only courses that have sections in the selected term', () => {
      expect(deriveCourseOptions(options, 1)).toEqual([options.courses[0], options.courses[1]]);
      expect(deriveCourseOptions(options, 2)).toEqual([options.courses[0]]);
    });
  });

  describe('deriveSectionOptions', () => {
    it('returns all sections when no term or course is selected', () => {
      expect(deriveSectionOptions(options, null, null)).toEqual(options.sections);
    });

    it('filters sections by the selected term', () => {
      expect(deriveSectionOptions(options, 2, null)).toEqual([options.sections[3]]);
    });

    it('filters sections by the selected course within the selected term', () => {
      expect(deriveSectionOptions(options, 1, 10)).toEqual([
        options.sections[0],
        options.sections[1],
      ]);
    });
  });

  describe('deriveCohortOptions', () => {
    it('returns the selected section cohort when a section is selected', () => {
      expect(deriveCohortOptions(options, 1, 10, 100)).toEqual(['2026']);
    });

    it('returns distinct cohorts of matching sections when no section is selected', () => {
      expect(deriveCohortOptions(options, 1, null, null)).toEqual(['2026', '2027']);
    });

    it('narrows cohorts by the selected course within a term', () => {
      expect(deriveCohortOptions(options, 1, 10, null)).toEqual(['2026']);
      expect(deriveCohortOptions(options, 1, 20, null)).toEqual(['2027']);
    });

    it('returns an empty list when matching sections have no cohort values', () => {
      const noCohorts: CatalogFilterOptions = {
        ...options,
        sections: options.sections.map((section) => ({ ...section, cohort: null })),
      };
      expect(deriveCohortOptions(noCohorts, null, null, null)).toEqual([]);
    });
  });

  describe('buildReportRequest', () => {
    it('omits studentId for student self-transcripts', () => {
      expect(
        buildReportRequest('official_transcript', 'student', 'en', emptyFilters, 'student-1'),
      ).toEqual({
        data: { reportType: 'official_transcript', locale: 'en', filters: emptyFilters },
      });
    });

    it('includes the selected student for admin transcripts', () => {
      expect(
        buildReportRequest('official_transcript', 'admin', 'id', emptyFilters, 'student-9'),
      ).toEqual({
        data: {
          reportType: 'official_transcript',
          locale: 'id',
          filters: emptyFilters,
          studentId: 'student-9',
        },
      });
    });

    it('omits studentId for admin institutional summaries', () => {
      expect(
        buildReportRequest(
          'institutional_academic_summary',
          'admin',
          'en',
          emptyFilters,
          'student-9',
        ),
      ).toEqual({
        data: { reportType: 'institutional_academic_summary', locale: 'en', filters: emptyFilters },
      });
    });

    it('omits studentId for instructor analytics', () => {
      expect(
        buildReportRequest('analytics_summary', 'instructor', 'id', emptyFilters, null),
      ).toEqual({
        data: { reportType: 'analytics_summary', locale: 'id', filters: emptyFilters },
      });
    });

    it('omits studentId when none is selected even for admin transcripts', () => {
      expect(buildReportRequest('official_transcript', 'admin', 'en', emptyFilters, null)).toEqual({
        data: { reportType: 'official_transcript', locale: 'en', filters: emptyFilters },
      });
    });
  });
});
