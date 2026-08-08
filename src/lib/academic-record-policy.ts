export type AcademicRecordStatus = 'complete' | 'incomplete' | 'withdrawn';

export type AcademicRecordPolicy = {
  gradePoints: Record<string, number>;
  roundingScale: number;
};

export type AcademicRecord = {
  id: number;
  courseId: number;
  termId: number;
  termStartDate: string | Date;
  publishedAt: string | Date;
  status: AcademicRecordStatus;
  letterGrade: string | null;
  credits: number;
  gradePoints?: number | null;
};

export type GpaCalculation = {
  gpa: number | null;
  totalCredits: number;
  totalQualityPoints: number;
  eligibleRecordIds: number[];
};

export const DEFAULT_ACADEMIC_RECORD_POLICY: AcademicRecordPolicy = {
  gradePoints: {
    A: 4,
    B: 3,
    C: 2,
    D: 1,
    F: 0,
  },
  roundingScale: 2,
};

const MAX_ROUNDING_SCALE = 4;

export function parseAcademicRecordPolicy(input: unknown): AcademicRecordPolicy {
  if (!input || typeof input !== 'object') {
    throw new Error('Academic-record policy must be an object');
  }

  const candidate = input as Partial<AcademicRecordPolicy>;
  const gradePoints = candidate.gradePoints;

  if (!gradePoints || typeof gradePoints !== 'object' || Array.isArray(gradePoints)) {
    throw new Error('Academic-record policy must define grade points');
  }

  const entries = Object.entries(gradePoints);
  if (entries.length === 0 || !Object.hasOwn(gradePoints, 'F')) {
    throw new Error('Academic-record policy must define an F grade');
  }

  for (const [letterGrade, points] of entries) {
    if (!letterGrade.trim() || !Number.isFinite(points) || points < 0 || points > 4) {
      throw new Error(`Invalid grade points for ${letterGrade}`);
    }
  }

  const roundingScale = candidate.roundingScale;
  if (
    typeof roundingScale !== 'number' ||
    !Number.isInteger(roundingScale) ||
    roundingScale < 0 ||
    roundingScale > MAX_ROUNDING_SCALE
  ) {
    throw new Error('Academic-record policy has an invalid rounding scale');
  }

  return {
    gradePoints: { ...gradePoints },
    roundingScale,
  };
}

export function isValidCourseCredits(credits: number): boolean {
  return Number.isFinite(credits) && credits > 0;
}

export function calculateTermGpa(
  records: AcademicRecord[],
  termId: number,
  policy: AcademicRecordPolicy,
): GpaCalculation {
  return calculateGpa(
    records.filter((record) => record.termId === termId),
    policy,
  );
}

export function calculateCumulativeGpa(
  records: AcademicRecord[],
  policy: AcademicRecordPolicy,
): GpaCalculation {
  const latestByCourse = new Map<number, AcademicRecord>();

  for (const record of records) {
    if (record.status !== 'complete') {
      continue;
    }

    const current = latestByCourse.get(record.courseId);
    if (!current || compareRecordOrder(record, current) > 0) {
      latestByCourse.set(record.courseId, record);
    }
  }

  return calculateGpa([...latestByCourse.values()], policy);
}

function calculateGpa(records: AcademicRecord[], policy: AcademicRecordPolicy): GpaCalculation {
  const eligibleRecords = records.filter((record) => record.status === 'complete');

  let totalCredits = 0;
  let totalQualityPoints = 0;

  for (const record of eligibleRecords) {
    if (!isValidCourseCredits(record.credits)) {
      throw new Error(`Academic record ${record.id} has invalid course credits`);
    }

    const gradePoints =
      record.gradePoints ??
      (record.letterGrade ? policy.gradePoints[record.letterGrade] : undefined);
    if (gradePoints === undefined || !Number.isFinite(gradePoints)) {
      throw new Error(`Academic record ${record.id} has an unmapped letter grade`);
    }

    totalCredits += record.credits;
    totalQualityPoints += record.credits * gradePoints;
  }

  return {
    gpa:
      totalCredits === 0
        ? null
        : roundHalfUp(totalQualityPoints / totalCredits, policy.roundingScale),
    totalCredits,
    totalQualityPoints,
    eligibleRecordIds: eligibleRecords.map((record) => record.id),
  };
}

function compareRecordOrder(left: AcademicRecord, right: AcademicRecord): number {
  const termStartDifference = toTimestamp(left.termStartDate) - toTimestamp(right.termStartDate);
  if (termStartDifference !== 0) {
    return termStartDifference;
  }

  if (left.termId !== right.termId) {
    return left.termId - right.termId;
  }

  const publicationDifference = toTimestamp(left.publishedAt) - toTimestamp(right.publishedAt);
  if (publicationDifference !== 0) {
    return publicationDifference;
  }

  return left.id - right.id;
}

function toTimestamp(value: string | Date): number {
  const timestamp = value instanceof Date ? value.getTime() : Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new Error('Academic record has an invalid date');
  }

  return timestamp;
}

function roundHalfUp(value: number, scale: number): number {
  const factor = 10 ** scale;
  return Math.floor(value * factor + 0.5 + Number.EPSILON) / factor;
}
