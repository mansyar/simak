// Academic-record persistence services (server-only, never client-bundled).
import { and, desc, eq, lte } from 'drizzle-orm';
import type { getDb } from '@/db/index';
import { academicTerms, courseSections, courses } from '@/db/schema/academic-context';
import { academicRecordPolicies, academicRecords } from '@/db/schema/academic-records';
import { assignments } from '@/db/schema/assignments';
import { assignmentGradeConfig, gradeReleaseSnapshots } from '@/db/schema/gradebook';
import { isValidCourseCredits, parseAcademicRecordPolicy } from '@/lib/academic-record-policy';

type Db = ReturnType<typeof getDb>;
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
type AcademicRecordDb = Db | Tx;

type AssignmentContextRow = {
  id: number;
  sectionId: number;
  courseId: number;
  termId: number;
  termStartDate: string;
  credits: string | number;
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
  sourceSnapshotId: number | null;
  sourceReleaseVersion: number | null;
  recordVersion: number;
};

type AcademicRecordReleaseInput = {
  assignmentId: number;
  releaseVersion: number;
};

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
    throw new Error('Assignment not found');
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
    throw new Error('A section must have exactly one transcript-source assignment');
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
    throw new Error('No active academic-record policy is configured for this term');
  }

  const policy = parseAcademicRecordPolicy({
    gradePoints: policyRow.gradePoints,
    roundingScale: policyRow.roundingScale,
  });
  const credits = String(assignment.credits);
  if (!isValidCourseCredits(Number(credits))) {
    throw new Error('Course credits must be positive');
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
    .where(
      and(
        eq(gradeReleaseSnapshots.assignmentId, input.assignmentId),
        eq(gradeReleaseSnapshots.releaseVersion, input.releaseVersion),
      ),
    )) as SnapshotRow[];

  if (
    snapshots.length === 0 ||
    snapshots.some(
      (snapshot) =>
        snapshot.status !== 'complete' ||
        snapshot.numericScore === null ||
        snapshot.letterGrade === null ||
        snapshot.publishedAt === null,
    )
  ) {
    throw new Error('No eligible published grade snapshots');
  }

  const existingRecords = (await db
    .select({
      id: academicRecords.id,
      studentId: academicRecords.studentId,
      sourceSnapshotId: academicRecords.sourceSnapshotId,
      sourceReleaseVersion: academicRecords.sourceReleaseVersion,
      recordVersion: academicRecords.recordVersion,
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

  const values = snapshots.flatMap((snapshot) => {
    if (existingSourceIds.has(snapshot.id)) {
      return [];
    }

    if (snapshot.letterGrade === null) {
      throw new Error('No eligible published grade snapshots');
    }

    const gradePoints = policy.gradePoints[snapshot.letterGrade];
    if (gradePoints === undefined) {
      throw new Error(`Academic-record policy does not map ${snapshot.letterGrade}`);
    }

    const recordVersion = (nextVersionByStudent.get(snapshot.studentId) ?? 0) + 1;
    nextVersionByStudent.set(snapshot.studentId, recordVersion);

    return [
      {
        studentId: snapshot.studentId,
        courseId: assignment.courseId,
        courseSectionId: assignment.sectionId,
        termId: assignment.termId,
        sourceAssignmentId: input.assignmentId,
        sourceSnapshotId: snapshot.id,
        sourceReleaseVersion: snapshot.releaseVersion,
        policyVersion: policyRow.version,
        recordVersion,
        numericScore: String(snapshot.numericScore),
        letterGrade: snapshot.letterGrade,
        status: 'complete' as const,
        credits,
        gradePoints: gradePoints.toFixed(2),
        publishedAt: snapshot.publishedAt,
      },
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
    throw new Error('Invalid academic-record release input');
  }
}

function assertPublishedRelease(config: ReleaseConfigRow | undefined, releaseVersion: number) {
  if (!config || config.releaseStatus !== 'published') {
    throw new Error('Academic records require a published release');
  }

  if (config.activeReleaseVersion !== releaseVersion) {
    throw new Error('Release version is not the active release version');
  }
}

function selectActiveRecordIds(records: ExistingRecordRow[]): number[] {
  const activeByStudent = new Map<string, ExistingRecordRow>();

  for (const record of records) {
    const current = activeByStudent.get(record.studentId);
    if (
      !current ||
      record.recordVersion > current.recordVersion ||
      (record.recordVersion === current.recordVersion && record.id > current.id)
    ) {
      activeByStudent.set(record.studentId, record);
    }
  }

  return [...activeByStudent.values()].map((record) => record.id);
}
