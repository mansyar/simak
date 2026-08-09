// Withdrawal persistence service (server-only, never client-bundled).
import { and, desc, eq, lte } from 'drizzle-orm';
import type { getDb } from '@/db/index';
import { academicTerms, courseSections, courses } from '@/db/schema/academic-context';
import { academicRecordPolicies, academicRecords } from '@/db/schema/academic-records';
import { assignments } from '@/db/schema/assignments';
import { assignmentGradeConfig } from '@/db/schema/gradebook';
import { isValidCourseCredits, parseAcademicRecordPolicy } from '@/lib/academic-record-policy';
import { ErrorCode } from '@/lib/errors';
import { AcademicRecordDomainError } from './academic-records-persistence.server';

type Db = ReturnType<typeof getDb>;
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

type AssignmentContextRow = {
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

type AcademicRecordWithdrawalInput = {
  assignmentId: number;
  releaseVersion: number;
  reason: string;
  actorId: string;
};

/** Persist an authorized withdrawal as a new, GPA-excluded immutable version. */
export async function persistWithdrawnAcademicRecordsForReleaseInTransaction(
  db: Tx,
  input: AcademicRecordWithdrawalInput,
) {
  validateReleaseInput(input);
  if (!input.reason.trim() || !input.actorId) {
    throw new AcademicRecordDomainError(
      ErrorCode.VALIDATION,
      'An authorized withdrawal reason is required',
    );
  }

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
      gradePoints: academicRecordPolicies.gradePoints,
      roundingScale: academicRecordPolicies.roundingScale,
      version: academicRecordPolicies.version,
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
  try {
    parseAcademicRecordPolicy({
      gradePoints: policyRow.gradePoints,
      roundingScale: policyRow.roundingScale,
    });
  } catch {
    throw new AcademicRecordDomainError('CONFLICT', 'Academic record policy is invalid');
  }

  if (assignment.credits === null) {
    throw new Error('Course credits are unavailable');
  }
  const credits = String(assignment.credits);
  if (!isValidCourseCredits(Number(credits))) {
    throw new Error('Course credits must be positive');
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
  const withdrawnStudents = new Set<string>();
  const sourceStudents = new Set<string>();
  for (const record of existingRecords) {
    nextVersionByStudent.set(
      record.studentId,
      Math.max(nextVersionByStudent.get(record.studentId) ?? 0, record.recordVersion),
    );

    if (
      record.sourceAssignmentId === input.assignmentId &&
      record.sourceReleaseVersion === input.releaseVersion
    ) {
      if (record.status === 'complete' || record.status === 'incomplete') {
        sourceStudents.add(record.studentId);
      }
      if (record.status === 'withdrawn') withdrawnStudents.add(record.studentId);
    }
  }

  const publishedAt = new Date();
  const values = [...sourceStudents].flatMap((studentId) => {
    if (withdrawnStudents.has(studentId)) return [];

    const recordVersion = (nextVersionByStudent.get(studentId) ?? 0) + 1;
    nextVersionByStudent.set(studentId, recordVersion);
    return [
      {
        studentId,
        courseId: assignment.courseId,
        courseSectionId: assignment.sectionId,
        termId: assignment.termId,
        sourceAssignmentId: input.assignmentId,
        sourceSnapshotId: null,
        sourceReleaseVersion: input.releaseVersion,
        policyVersion: policyRow.version,
        recordVersion,
        numericScore: null,
        letterGrade: null,
        status: 'withdrawn' as const,
        credits,
        gradePoints: null,
        outcomeReason: input.reason.trim(),
        outcomeActorId: input.actorId,
        publishedAt,
      },
    ];
  });

  const inserted = values.length ? await db.insert(academicRecords).values(values).returning() : [];
  const persisted = [...existingRecords, ...(inserted as ExistingRecordRow[])];

  return {
    success: true as const,
    assignmentId: input.assignmentId,
    releaseVersion: input.releaseVersion,
    createdCount: values.length,
    recordIds: (inserted as Array<{ id: number }>).map((record) => record.id),
    activeRecordIds: selectActiveRecordIds(persisted),
  };
}

async function getAssignmentContext(
  db: Tx,
  assignmentId: number,
): Promise<AssignmentContextRow | null> {
  const [row] = await db
    .select({
      sectionId: courseSections.id,
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

function validateReleaseInput(input: AcademicRecordWithdrawalInput) {
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
