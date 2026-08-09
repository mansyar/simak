/** @vitest-environment node */
import { eq, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getDb } from '@/db/index';
import {
  academicRecordPolicies,
  academicRecords,
  academicTerms,
  assignments,
  assignmentTemplates,
  courseSections,
  courses,
  gradeReleaseSnapshots,
  users,
} from '@/db/schema';

describe('academic-record database integrity', () => {
  const db = getDb();

  it('applies the review constraints and immutability triggers', async () => {
    const triggers = await db.execute(sql`
      SELECT tgname
      FROM pg_trigger
      WHERE NOT tgisinternal
        AND tgrelid = ANY(ARRAY[
          'academic_records'::regclass,
          'academic_record_policies'::regclass,
          'grade_release_snapshots'::regclass,
          'assignments'::regclass
        ])
    `);
    const triggerNames = triggers.map((row) => row.tgname as string);

    expect(triggerNames).toEqual(
      expect.arrayContaining([
        'academic_records_immutable_trigger',
        'academic_record_policies_immutable_trigger',
        'grade_release_snapshots_immutable_trigger',
        'academic_records_provenance_trigger',
        'assignments_transcript_source_immutable_trigger',
      ]),
    );

    const constraints = await db.execute(sql`
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'academic_records'::regclass
    `);
    const constraintNames = constraints.map((row) => row.conname as string);

    expect(constraintNames).toEqual(
      expect.arrayContaining([
        'academic_records_complete_source_required',
        'academic_records_non_complete_outcome_required',
        'academic_records_withdrawn_source_absent',
      ]),
    );
  });

  it('adds nullable credits without rejecting an existing course row', async () => {
    const migration = readFileSync(
      resolve(process.cwd(), 'drizzle/migrations/0028_flowery_cyclops.sql'),
      'utf8',
    );
    const addCredits = migration.match(
      /ALTER TABLE "courses" ADD COLUMN "credits" numeric\(5, 2\)(?: NOT NULL)?;/i,
    )?.[0];
    expect(addCredits).toBeDefined();

    const rollback = new Error('rollback existing-course migration fixture');
    await expect(
      db.transaction(async (tx) => {
        await tx.execute(sql`CREATE TEMP TABLE courses (id integer PRIMARY KEY) ON COMMIT DROP`);
        await tx.execute(sql`INSERT INTO courses (id) VALUES (1)`);
        await tx.execute(sql.raw(addCredits!));

        const rows = await tx.execute(sql`SELECT credits FROM courses WHERE id = 1`);
        expect(rows).toEqual([{ credits: null }]);
        throw rollback;
      }),
    ).rejects.toBe(rollback);
  });

  it('rejects direct mutation of an official academic record', async () => {
    const rollback = new Error('rollback academic-record fixture');

    await expect(
      db.transaction(async (tx) => {
        const suffix = randomUUID();
        const studentId = `academic-record-student-${suffix}`;
        const otherStudentId = `academic-record-other-student-${suffix}`;
        const instructorId = `academic-record-instructor-${suffix}`;

        await tx.insert(users).values([
          {
            id: otherStudentId,
            name: 'Other Academic Record Student',
            email: `${otherStudentId}@test.invalid`,
            role: 'student',
          },
          {
            id: studentId,
            name: 'Academic Record Student',
            email: `${studentId}@test.invalid`,
            role: 'student',
          },
          {
            id: instructorId,
            name: 'Academic Record Instructor',
            email: `${instructorId}@test.invalid`,
            role: 'instructor',
          },
        ]);

        const [term] = await tx
          .insert(academicTerms)
          .values({
            code: `AR-${suffix}`,
            name: 'Academic Record Integrity Term',
            startDate: '2026-01-01',
            endDate: '2026-06-30',
            status: 'active',
          })
          .returning({ id: academicTerms.id });
        const [course] = await tx
          .insert(courses)
          .values({
            code: `AR-${suffix}`,
            name: 'Academic Record Integrity Course',
            credits: '3.00',
          })
          .returning({ id: courses.id });
        const [otherCourse] = await tx
          .insert(courses)
          .values({ code: `AR-OTHER-${suffix}`, name: 'Other Course', credits: '3.00' })
          .returning({ id: courses.id });
        const [otherTerm] = await tx
          .insert(academicTerms)
          .values({
            code: `AR-OTHER-${suffix}`,
            name: 'Other Term',
            startDate: '2026-07-01',
            endDate: '2026-12-31',
            status: 'active',
          })
          .returning({ id: academicTerms.id });
        const [section] = await tx
          .insert(courseSections)
          .values({ termId: term.id, courseId: course.id, code: 'A', status: 'active' })
          .returning({ id: courseSections.id });
        const [template] = await tx
          .insert(assignmentTemplates)
          .values({ type: 'thesis', name: `AR Template ${suffix}`, createdBy: instructorId })
          .returning({ id: assignmentTemplates.id });
        const [assignment] = await tx
          .insert(assignments)
          .values({
            templateId: template.id,
            title: `AR Assignment ${suffix}`,
            finalDeadline: new Date('2026-06-30T00:00:00Z'),
            instructorId,
            sectionId: section.id,
            isTranscriptSource: true,
            status: 'active',
          })
          .returning({ id: assignments.id });
        const [otherSection] = await tx
          .insert(courseSections)
          .values({ termId: term.id, courseId: course.id, code: 'B', status: 'active' })
          .returning({ id: courseSections.id });
        const [otherAssignment] = await tx
          .insert(assignments)
          .values({
            templateId: template.id,
            title: `Other AR Assignment ${suffix}`,
            finalDeadline: new Date('2026-06-30T00:00:00Z'),
            instructorId,
            sectionId: otherSection.id,
            isTranscriptSource: true,
            status: 'active',
          })
          .returning({ id: assignments.id });
        const policyVersion = 900000 + Math.floor(Math.random() * 9999);
        const [policy] = await tx
          .insert(academicRecordPolicies)
          .values({
            version: policyVersion,
            effectiveTermId: term.id,
            gradePoints: { A: 4, F: 0 },
            roundingScale: 2,
            isActive: true,
          })
          .returning({ version: academicRecordPolicies.version });
        const [snapshot] = await tx
          .insert(gradeReleaseSnapshots)
          .values({
            assignmentId: assignment.id,
            studentId,
            releaseVersion: 1,
            numericScore: '95.00',
            letterGrade: 'A',
            status: 'complete',
            contributingCheckpoints: [],
            publishedAt: new Date('2026-02-01T00:00:00Z'),
          })
          .returning({ id: gradeReleaseSnapshots.id });
        const [otherSnapshot] = await tx
          .insert(gradeReleaseSnapshots)
          .values({
            assignmentId: otherAssignment.id,
            studentId,
            releaseVersion: 1,
            numericScore: '95.00',
            letterGrade: 'A',
            status: 'complete',
            contributingCheckpoints: [],
            publishedAt: new Date('2026-02-01T00:00:00Z'),
          })
          .returning({ id: gradeReleaseSnapshots.id });
        const recordValues = {
          studentId,
          courseId: course.id,
          courseSectionId: section.id,
          termId: term.id,
          sourceAssignmentId: assignment.id,
          sourceSnapshotId: snapshot.id,
          sourceReleaseVersion: 1,
          policyVersion: policy.version,
          recordVersion: 1,
          numericScore: '95.00',
          letterGrade: 'A',
          status: 'complete' as const,
          credits: '3.00',
          gradePoints: '4.00',
          publishedAt: new Date('2026-02-01T00:00:00Z'),
        };
        const [record] = await tx
          .insert(academicRecords)
          .values(recordValues)
          .returning({ id: academicRecords.id });

        const contradictoryRecords = [
          { ...recordValues, recordVersion: 2, studentId: otherStudentId },
          { ...recordValues, recordVersion: 2, sourceSnapshotId: otherSnapshot.id },
          { ...recordValues, recordVersion: 2, sourceReleaseVersion: 2 },
          { ...recordValues, recordVersion: 2, courseId: otherCourse.id },
          { ...recordValues, recordVersion: 2, termId: otherTerm.id },
        ];
        for (const [index, values] of contradictoryRecords.entries()) {
          await tx.execute(sql.raw(`SAVEPOINT contradictory_record_${index}`));
          await expect(tx.insert(academicRecords).values(values)).rejects.toThrow();
          await tx.execute(sql.raw(`ROLLBACK TO SAVEPOINT contradictory_record_${index}`));
        }

        await tx.execute(sql`SAVEPOINT source_designation_mutation_attempt`);
        await expect(
          tx
            .update(assignments)
            .set({ isTranscriptSource: false })
            .where(eq(assignments.id, assignment.id)),
        ).rejects.toThrow();
        await tx.execute(sql`ROLLBACK TO SAVEPOINT source_designation_mutation_attempt`);

        await tx.execute(sql`SAVEPOINT academic_record_update_attempt`);
        await expect(
          tx
            .update(academicRecords)
            .set({ gradePoints: '3.00' })
            .where(eq(academicRecords.id, record.id)),
        ).rejects.toThrow();
        await tx.execute(sql`ROLLBACK TO SAVEPOINT academic_record_update_attempt`);

        await tx.execute(sql`SAVEPOINT academic_record_delete_attempt`);
        await expect(
          tx.delete(academicRecords).where(eq(academicRecords.id, record.id)),
        ).rejects.toThrow();
        await tx.execute(sql`ROLLBACK TO SAVEPOINT academic_record_delete_attempt`);

        throw rollback;
      }),
    ).rejects.toBe(rollback);
  });
});
