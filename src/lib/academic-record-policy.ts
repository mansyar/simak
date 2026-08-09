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
    try {
      decimalToMinorUnits(points, 'grade points');
    } catch {
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
  if (!Number.isFinite(credits)) return false;
  try {
    return decimalToMinorUnits(credits, 'course credits') > 0n;
  } catch {
    return false;
  }
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

  let totalCreditsMinor = 0n;
  let totalQualityPointsMinor = 0n;

  for (const record of eligibleRecords) {
    let creditsMinor: bigint;
    try {
      creditsMinor = decimalToMinorUnits(record.credits, 'course credits');
    } catch {
      creditsMinor = 0n;
    }
    if (creditsMinor <= 0n) {
      throw new Error(`Academic record ${record.id} has invalid course credits`);
    }

    const gradePoints =
      record.gradePoints ??
      (record.letterGrade ? policy.gradePoints[record.letterGrade] : undefined);
    if (gradePoints === undefined || !Number.isFinite(gradePoints)) {
      throw new Error(`Academic record ${record.id} has an unmapped letter grade`);
    }

    let gradePointsMinor: bigint;
    try {
      gradePointsMinor = decimalToMinorUnits(gradePoints, 'grade points');
    } catch {
      throw new Error(`Academic record ${record.id} has invalid grade points`);
    }

    totalCreditsMinor += creditsMinor;
    totalQualityPointsMinor += creditsMinor * gradePointsMinor;
  }

  const totalCredits = Number(totalCreditsMinor) / 100;
  const totalQualityPoints = Number(totalQualityPointsMinor) / 10_000;

  return {
    gpa:
      totalCredits === 0
        ? null
        : roundHalfUp(totalQualityPointsMinor, totalCreditsMinor, policy.roundingScale),
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

function roundHalfUp(qualityPointsMinor: bigint, creditsMinor: bigint, scale: number): number {
  const factor = 10n ** BigInt(scale);
  const denominator = creditsMinor * 100n;
  const scaledNumerator = qualityPointsMinor * factor;
  let rounded = scaledNumerator / denominator;
  if ((scaledNumerator % denominator) * 2n >= denominator) rounded += 1n;
  return Number(rounded) / Number(factor);
}

function decimalToMinorUnits(value: number, label: string): bigint {
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite`);

  const match = String(value).match(/^([+-]?)(\d+)(?:\.(\d*))?(?:e([+-]?\d+))?$/i);
  if (!match) throw new Error(`${label} must be a decimal`);

  const sign = match[1] === '-' ? -1n : 1n;
  const integerPart = match[2];
  const fractionPart = match[3] ?? '';
  const exponent = Number(match[4] ?? 0);
  const digits = integerPart + fractionPart;
  const decimalIndex = integerPart.length + exponent;
  let wholePart: string;
  let fractionalPart: string;

  if (decimalIndex <= 0) {
    wholePart = '0';
    fractionalPart = '0'.repeat(-decimalIndex) + digits;
  } else if (decimalIndex >= digits.length) {
    wholePart = digits.padEnd(decimalIndex, '0');
    fractionalPart = '';
  } else {
    wholePart = digits.slice(0, decimalIndex);
    fractionalPart = digits.slice(decimalIndex);
  }

  fractionalPart = fractionalPart.replace(/0+$/, '');
  if (fractionalPart.length > 2) throw new Error(`${label} supports at most two decimals`);
  const minorDigits = `${wholePart}${fractionalPart.padEnd(2, '0')}`;
  return sign * BigInt(minorDigits || '0');
}
