// Academic-record persistence services (server-only, never client-bundled).
import { and, desc, eq, lte } from 'drizzle-orm';
import type { getDb } from '@/db/index';
import {
  academicTerms,
  courseSections,
  courses,
  sectionEnrollments,
} from '@/db/schema/academic-context';
import { academicRecordPolicies, academicRecords } from '@/db/schema/academic-records';
import { assignments } from '@/db/schema/assignments';
import { assignmentGradeConfig, gradeReleaseSnapshots } from '@/db/schema/gradebook';
import { isValidCourseCredits, parseAcademicRecordPolicy } from '@/lib/academic-record-policy';
import { ErrorCode, type ErrorCode as ErrorCodeType } from '@/lib/errors';

type Db = ReturnType<typeof getDb>;
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
type AcademicRecordDb = Db | Tx;

type AssignmentContextRow = {
  id: number;
  sectionId: number;
  courseId: number;
  termId: number;
  termStartDate: string;
  credits: string | number | null;
};

type ReleaseConfigRow = {
  releaseStatus: 'draft' | 'published';
  activeReleaseVersion: number | null;
};

type SnapshotRow = {
  id: number;
  studentId: string;
  releaseVersion: number;
  numericScore: string | number | null;
  letterGrade: string | null;
  status: 'complete' | 'incomplete' | 'in_progress';
  publishedAt: Date;
};

type ExistingRecordRow = {
  id: number;
  studentId: string;
  sourceAssignmentId?: number;
  sourceSnapshotId: number | null;
  sourceReleaseVersion: number | null;
  publishedAt: Date | string;
  recordVersion: number;
  status?: 'complete' | 'incomplete' | 'withdrawn';
};

type AcademicRecordReleaseInput = {
  assignmentId: number;
  releaseVersion: number;
  actorId?: string;
  incompleteReasons?: Record<string, string>;
};

export class AcademicRecordDomainError extends Error {
  constructor(
    readonly code: ErrorCodeType,
    message: string,
  ) {
    super(message);
    this.name = 'AcademicRecordDomainError';
  }
}

function domainError(code: ErrorCodeType, message: string): never {
  throw new AcademicRecordDomainError(code, message);
}

/**
 * Persist official records for a published transcript-source assignment.
 * Callers that already own a transaction should use the transaction variant.
 */
export async function persistAcademicRecordsForRelease(db: Db, input: AcademicRecordReleaseInput) {
  return db.transaction((tx) => persistAcademicRecordsForReleaseInTransaction(tx, input));
}

/** Persist official records using the caller's existing transaction boundary. */
export async function persistAcademicRecordsForReleaseInTransaction(
  db: Tx,
  input: AcademicRecordReleaseInput,
) {
  validateReleaseInput(input);

  const assignment = await getAssignmentContext(db, input.assignmentId);
  if (!assignment) {
    domainError(ErrorCode.NOT_FOUND, 'Assignment not found');
  }

  const sourceAssignments = await db
    .select({ id: assignments.id })
    .from(assignments)
    .where(
      and(
        eq(assignments.sectionId, assignment.sectionId),
        eq(assignments.isTranscriptSource, true),
      ),
    );

  if (sourceAssignments.length !== 1 || sourceAssignments[0]?.id !== input.assignmentId) {
    domainError(ErrorCode.CONFLICT, 'A section must have exactly one transcript-source assignment');
  }

  const [releaseConfig] = await db
    .select({
      releaseStatus: assignmentGradeConfig.releaseStatus,
      activeReleaseVersion: assignmentGradeConfig.activeReleaseVersion,
    })
    .from(assignmentGradeConfig)
    .where(eq(assignmentGradeConfig.assignmentId, input.assignmentId))
    .limit(1);

  assertPublishedRelease(releaseConfig as ReleaseConfigRow | undefined, input.releaseVersion);

  const [policyRow] = await db
    .select({
      id: academicRecordPolicies.id,
      version: academicRecordPolicies.version,
      gradePoints: academicRecordPolicies.gradePoints,
      roundingScale: academicRecordPolicies.roundingScale,
    })
    .from(academicRecordPolicies)
    .innerJoin(academicTerms, eq(academicTerms.id, academicRecordPolicies.effectiveTermId))
    .where(
      and(
        eq(academicRecordPolicies.isActive, true),
        lte(academicTerms.startDate, assignment.termStartDate),
      ),
    )
    .orderBy(
      desc(academicTerms.startDate),
      desc(academicRecordPolicies.version),
      desc(academicRecordPolicies.id),
    )
    .limit(1);

  if (!policyRow) {
    domainError(
      ErrorCode.VALIDATION,
      'No active academic-record policy is configured for this term',
    );
  }

  let policy: ReturnType<typeof parseAcademicRecordPolicy>;
  try {
    policy = parseAcademicRecordPolicy({
      gradePoints: policyRow.gradePoints,
      roundingScale: policyRow.roundingScale,
    });
  } catch {
    throw new AcademicRecordDomainError('CONFLICT', 'Academic record policy is invalid');
  }
  if (assignment.credits === null) {
    domainError(ErrorCode.VALIDATION, 'Course credits are unavailable');
  }
  const credits = String(assignment.credits);
  if (!isValidCourseCredits(Number(credits))) {
    domainError(ErrorCode.VALIDATION, 'Course credits must be positive');
  }

  const snapshots = (await db
    .select({
      id: gradeReleaseSnapshots.id,
      studentId: gradeReleaseSnapshots.studentId,
      releaseVersion: gradeReleaseSnapshots.releaseVersion,
      numericScore: gradeReleaseSnapshots.numericScore,
      letterGrade: gradeReleaseSnapshots.letterGrade,
      status: gradeReleaseSnapshots.status,
      publishedAt: gradeReleaseSnapshots.publishedAt,
    })
    .from(gradeReleaseSnapshots)
    .innerJoin(
      sectionEnrollments,
      and(
        eq(sectionEnrollments.sectionId, assignment.sectionId),
        eq(sectionEnrollments.userId, gradeReleaseSnapshots.studentId),
        eq(sectionEnrollments.role, 'student'),
        eq(sectionEnrollments.isActive, true),
      ),
    )
    .where(
      and(
        eq(gradeReleaseSnapshots.assignmentId, input.assignmentId),
        eq(gradeReleaseSnapshots.releaseVersion, input.releaseVersion),
      ),
    )) as SnapshotRow[];

  if (snapshots.length === 0) {
    domainError(ErrorCode.VALIDATION, 'No eligible published grade snapshots');
  }

  if (snapshots.some((snapshot) => snapshot.status === 'in_progress')) {
    domainError(
      ErrorCode.VALIDATION,
      'In-progress grade snapshots are not available for academic records',
    );
  }

  if (
    snapshots.some(
      (snapshot) =>
        snapshot.publishedAt === null ||
        (snapshot.status === 'complete' &&
          (snapshot.numericScore === null || snapshot.letterGrade === null)) ||
        (snapshot.status === 'incomplete' &&
          (snapshot.numericScore !== null || snapshot.letterGrade !== null)),
    )
  ) {
    domainError(ErrorCode.VALIDATION, 'Invalid published grade snapshot outcome');
  }

  if (
    snapshots.some(
      (snapshot) =>
        snapshot.status === 'incomplete' &&
        (!input.actorId || !input.incompleteReasons?.[snapshot.studentId]?.trim()),
    )
  ) {
    domainError(
      ErrorCode.VALIDATION,
      'Incomplete academic records require an authorized actor and reason',
    );
  }

  const existingRecords = (await db
    .select({
      id: academicRecords.id,
      studentId: academicRecords.studentId,
      sourceAssignmentId: academicRecords.sourceAssignmentId,
      sourceSnapshotId: academicRecords.sourceSnapshotId,
      sourceReleaseVersion: academicRecords.sourceReleaseVersion,
      recordVersion: academicRecords.recordVersion,
      publishedAt: academicRecords.publishedAt,
      status: academicRecords.status,
    })
    .from(academicRecords)
    .where(eq(academicRecords.courseSectionId, assignment.sectionId))) as ExistingRecordRow[];

  const nextVersionByStudent = new Map<string, number>();
  const existingSourceIds = new Set<number>();
  for (const record of existingRecords) {
    nextVersionByStudent.set(
      record.studentId,
      Math.max(nextVersionByStudent.get(record.studentId) ?? 0, record.recordVersion),
    );
    if (record.sourceSnapshotId !== null) {
      existingSourceIds.add(record.sourceSnapshotId);
    }
  }

  const values: Array<typeof academicRecords.$inferInsert> = snapshots.flatMap((snapshot) => {
    if (existingSourceIds.has(snapshot.id)) {
      return [];
    }

    const recordVersion = (nextVersionByStudent.get(snapshot.studentId) ?? 0) + 1;
    nextVersionByStudent.set(snapshot.studentId, recordVersion);

    if (snapshot.status === 'incomplete') {
      return [
        {
          studentId: snapshot.studentId,
          courseId: assignment.courseId,
          courseSectionId: assignment.sectionId,
          termId: assignment.termId,
          sourceAssignmentId: input.assignmentId,
          sourceSnapshotId: snapshot.id,
          sourceReleaseVersion: input.releaseVersion,
          policyVersion: policyRow.version,
          recordVersion,
          numericScore: null,
          letterGrade: null,
          status: 'incomplete' as const,
          credits,
          gradePoints: null,
          outcomeReason: input.incompleteReasons![snapshot.studentId]!.trim(),
          outcomeActorId: input.actorId!,
          publishedAt: snapshot.publishedAt,
        } as typeof academicRecords.$inferInsert,
      ];
    }

    if (snapshot.letterGrade === null || snapshot.numericScore === null) {
      domainError(ErrorCode.VALIDATION, 'Invalid published grade snapshot outcome');
    }

    const gradePoints = policy.gradePoints[snapshot.letterGrade];
    if (gradePoints === undefined) {
      domainError(
        ErrorCode.VALIDATION,
        `Academic-record policy does not map ${snapshot.letterGrade}`,
      );
    }

    return [
      {
        studentId: snapshot.studentId,
        courseId: assignment.courseId,
        courseSectionId: assignment.sectionId,
        termId: assignment.termId,
        sourceAssignmentId: input.assignmentId,
        sourceSnapshotId: snapshot.id,
        sourceReleaseVersion: input.releaseVersion,
        policyVersion: policyRow.version,
        recordVersion,
        numericScore: String(snapshot.numericScore),
        letterGrade: snapshot.letterGrade,
        status: 'complete' as const,
        credits,
        gradePoints: gradePoints.toFixed(2),
        outcomeReason: null,
        outcomeActorId: null,
        publishedAt: snapshot.publishedAt,
      } as typeof academicRecords.$inferInsert,
    ];
  });

  const inserted = values.length ? await db.insert(academicRecords).values(values).returning() : [];
  const persisted = [...existingRecords, ...(inserted as ExistingRecordRow[])];
  const activeRecordIds = selectActiveRecordIds(persisted);

  return {
    success: true as const,
    assignmentId: input.assignmentId,
    courseSectionId: assignment.sectionId,
    releaseVersion: input.releaseVersion,
    policyVersion: policyRow.version,
    createdCount: values.length,
    skippedCount: snapshots.length - values.length,
    recordIds: (inserted as Array<{ id: number }>).map((record) => record.id),
    activeRecordIds,
  };
}

async function getAssignmentContext(
  db: AcademicRecordDb,
  assignmentId: number,
): Promise<AssignmentContextRow | null> {
  const [row] = await db
    .select({
      id: assignments.id,
      sectionId: assignments.sectionId,
      courseId: courseSections.courseId,
      termId: courseSections.termId,
      termStartDate: academicTerms.startDate,
      credits: courses.credits,
    })
    .from(assignments)
    .innerJoin(courseSections, eq(courseSections.id, assignments.sectionId))
    .innerJoin(courses, eq(courses.id, courseSections.courseId))
    .innerJoin(academicTerms, eq(academicTerms.id, courseSections.termId))
    .where(eq(assignments.id, assignmentId))
    .limit(1);

  return (row as AssignmentContextRow | undefined) ?? null;
}

function validateReleaseInput(input: AcademicRecordReleaseInput) {
  if (
    !Number.isInteger(input.assignmentId) ||
    input.assignmentId <= 0 ||
    !Number.isInteger(input.releaseVersion) ||
    input.releaseVersion <= 0
  ) {
    domainError(ErrorCode.VALIDATION, 'Invalid academic-record release input');
  }
}

function assertPublishedRelease(config: ReleaseConfigRow | undefined, releaseVersion: number) {
  if (!config || config.releaseStatus !== 'published') {
    domainError(ErrorCode.CONFLICT, 'Academic records require a published release');
  }

  if (config.activeReleaseVersion !== releaseVersion) {
    domainError(ErrorCode.CONFLICT, 'Release version is not the active release version');
  }
}

function selectActiveRecordIds(records: ExistingRecordRow[]): number[] {
  const activeByStudent = new Map<string, ExistingRecordRow>();

  for (const record of records) {
    const current = activeByStudent.get(record.studentId);
    if (!current || compareActiveRecord(record, current) > 0) {
      activeByStudent.set(record.studentId, record);
    }
  }

  return [...activeByStudent.values()].map((record) => record.id);
}

function compareActiveRecord(left: ExistingRecordRow, right: ExistingRecordRow): number {
  const releaseDifference = (left.sourceReleaseVersion ?? 0) - (right.sourceReleaseVersion ?? 0);
  if (releaseDifference !== 0) return releaseDifference;
  const publicationDifference =
    new Date(left.publishedAt).getTime() - new Date(right.publishedAt).getTime();
  return publicationDifference || left.id - right.id;
}
