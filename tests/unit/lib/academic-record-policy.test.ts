import {
  DEFAULT_ACADEMIC_RECORD_POLICY,
  calculateCumulativeGpa,
  calculateTermGpa,
  isValidCourseCredits,
  parseAcademicRecordPolicy,
  type AcademicRecord,
} from '@/lib/academic-record-policy';

const policy = parseAcademicRecordPolicy({
  gradePoints: DEFAULT_ACADEMIC_RECORD_POLICY.gradePoints,
  roundingScale: 2,
});

const record = (overrides: Partial<AcademicRecord> = {}): AcademicRecord => ({
  id: 1,
  courseId: 101,
  termId: 1,
  termStartDate: '2025-01-01',
  publishedAt: '2025-06-01T00:00:00.000Z',
  status: 'complete',
  letterGrade: 'A',
  credits: 3,
  ...overrides,
});

describe('academic-record policy', () => {
  describe('parseAcademicRecordPolicy', () => {
    it('accepts the default mapping and half-up rounding scale', () => {
      expect(policy).toEqual({
        gradePoints: {
          A: 4,
          B: 3,
          C: 2,
          D: 1,
          F: 0,
        },
        roundingScale: 2,
      });
    });

    it('accepts explicit plus and minus grade points', () => {
      expect(
        parseAcademicRecordPolicy({
          gradePoints: {
            A: 4,
            'A-': 3.7,
            'B+': 3.3,
            B: 3,
            F: 0,
          },
          roundingScale: 2,
        }),
      ).toMatchObject({ roundingScale: 2 });
    });

    it('rejects missing, non-finite, or out-of-range grade points', () => {
      expect(() =>
        parseAcademicRecordPolicy({
          gradePoints: { A: 4 },
          roundingScale: 2,
        }),
      ).toThrow();
      expect(() =>
        parseAcademicRecordPolicy({
          gradePoints: { A: 4, F: Number.NaN },
          roundingScale: 2,
        }),
      ).toThrow();
      expect(() =>
        parseAcademicRecordPolicy({
          gradePoints: { A: 4.1, F: 0 },
          roundingScale: 2,
        }),
      ).toThrow();
    });

    it('rejects unsupported rounding scales', () => {
      expect(() =>
        parseAcademicRecordPolicy({
          gradePoints: DEFAULT_ACADEMIC_RECORD_POLICY.gradePoints,
          roundingScale: 1.5,
        }),
      ).toThrow();
      expect(() =>
        parseAcademicRecordPolicy({
          gradePoints: DEFAULT_ACADEMIC_RECORD_POLICY.gradePoints,
          roundingScale: -1,
        }),
      ).toThrow();
    });
  });

  describe('course credits', () => {
    it('accepts positive finite credits and rejects missing or invalid values', () => {
      expect(isValidCourseCredits(3)).toBe(true);
      expect(isValidCourseCredits(0)).toBe(false);
      expect(isValidCourseCredits(-1)).toBe(false);
      expect(isValidCourseCredits(Number.NaN)).toBe(false);
      expect(isValidCourseCredits(Number.POSITIVE_INFINITY)).toBe(false);
      expect(isValidCourseCredits(0.001)).toBe(false);
    });
  });

  describe('calculateTermGpa', () => {
    it('uses the immutable stored grade points for released records', () => {
      const result = calculateTermGpa([record({ gradePoints: 3.5 })], 1, policy);

      expect(result).toMatchObject({
        gpa: 3.5,
        totalQualityPoints: 10.5,
      });
    });

    it('calculates a rounded credit-weighted term GPA', () => {
      const result = calculateTermGpa(
        [
          record({ id: 1, letterGrade: 'A', credits: 3 }),
          record({ id: 2, courseId: 102, letterGrade: 'B', credits: 3 }),
          record({ id: 3, courseId: 103, letterGrade: 'C', credits: 2 }),
        ],
        1,
        policy,
      );

      expect(result).toEqual({
        gpa: 3.13,
        totalCredits: 8,
        totalQualityPoints: 25,
        eligibleRecordIds: [1, 2, 3],
      });
    });

    it('excludes incomplete and withdrawn records and reports no eligible records', () => {
      const result = calculateTermGpa(
        [record({ id: 2, status: 'incomplete' }), record({ id: 3, status: 'withdrawn' })],
        1,
        policy,
      );

      expect(result).toEqual({
        gpa: null,
        totalCredits: 0,
        totalQualityPoints: 0,
        eligibleRecordIds: [],
      });
    });

    it('ignores records from other terms', () => {
      const result = calculateTermGpa(
        [record({ id: 1 }), record({ id: 2, termId: 2, letterGrade: 'F' })],
        1,
        policy,
      );

      expect(result.eligibleRecordIds).toEqual([1]);
      expect(result.gpa).toBe(4);
    });

    it('rounds exact decimal half cases upward without binary floating-point drift', () => {
      const result = calculateTermGpa(
        [
          record({ id: 1, credits: 0.01, gradePoints: 2.34 }),
          record({ id: 2, credits: 0.01, gradePoints: 2.35 }),
        ],
        1,
        policy,
      );

      expect(result.gpa).toBe(2.35);
    });
  });

  describe('calculateCumulativeGpa', () => {
    it('uses the latest eligible attempt for each course and retains other courses', () => {
      const result = calculateCumulativeGpa(
        [
          record({ id: 1, termId: 1, termStartDate: '2025-01-01', letterGrade: 'F' }),
          record({
            id: 2,
            termId: 2,
            termStartDate: '2026-01-01',
            publishedAt: '2026-06-01T00:00:00.000Z',
            letterGrade: 'A',
          }),
          record({
            id: 3,
            courseId: 102,
            termId: 2,
            termStartDate: '2026-01-01',
            letterGrade: 'B',
          }),
        ],
        policy,
      );

      expect(result).toEqual({
        gpa: 3.5,
        totalCredits: 6,
        totalQualityPoints: 21,
        eligibleRecordIds: [2, 3],
      });
    });

    it('uses record id as the deterministic tie breaker', () => {
      const result = calculateCumulativeGpa(
        [record({ id: 10, letterGrade: 'F' }), record({ id: 11, letterGrade: 'A' })],
        policy,
      );

      expect(result.eligibleRecordIds).toEqual([11]);
      expect(result.gpa).toBe(4);
    });
  });
});
