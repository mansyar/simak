import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';
import { assignments } from './assignments';
import { academicTerms, courseSections, courses } from './academic-context';
import { gradeReleaseSnapshots } from './gradebook';
import { users } from './users';

export const academicRecordStatus = pgEnum('academic_record_status', [
  'complete',
  'incomplete',
  'withdrawn',
]);

export const academicRecordPolicies = pgTable(
  'academic_record_policies',
  {
    id: serial('id').primaryKey(),
    version: integer('version').notNull(),
    effectiveTermId: integer('effective_term_id')
      .notNull()
      .references(() => academicTerms.id),
    gradePoints: jsonb('grade_points').notNull(),
    roundingScale: integer('rounding_scale').notNull().default(2),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    unique('academic_record_policies_version_unq').on(table.version),
    index('academic_record_policies_effective_term_idx').on(table.effectiveTermId, table.isActive),
    check(
      'academic_record_policies_rounding_scale_range',
      sql`${table.roundingScale} >= 0 AND ${table.roundingScale} <= 4`,
    ),
  ],
);

export const academicRecords = pgTable(
  'academic_records',
  {
    id: serial('id').primaryKey(),
    studentId: text('student_id')
      .notNull()
      .references(() => users.id),
    courseId: integer('course_id')
      .notNull()
      .references(() => courses.id),
    courseSectionId: integer('course_section_id')
      .notNull()
      .references(() => courseSections.id),
    termId: integer('term_id')
      .notNull()
      .references(() => academicTerms.id),
    sourceAssignmentId: integer('source_assignment_id')
      .notNull()
      .references(() => assignments.id),
    sourceSnapshotId: integer('source_snapshot_id').references(() => gradeReleaseSnapshots.id),
    sourceReleaseVersion: integer('source_release_version'),
    policyVersion: integer('policy_version')
      .notNull()
      .references(() => academicRecordPolicies.version),
    recordVersion: integer('record_version').notNull(),
    numericScore: numeric('numeric_score', { precision: 5, scale: 2 }),
    letterGrade: text('letter_grade'),
    status: academicRecordStatus('status').notNull(),
    credits: numeric('credits', { precision: 5, scale: 2 }).notNull(),
    gradePoints: numeric('grade_points', { precision: 4, scale: 2 }),
    publishedAt: timestamp('published_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    unique('academic_records_student_section_version_unq').on(
      table.studentId,
      table.courseSectionId,
      table.recordVersion,
    ),
    index('academic_records_student_term_idx').on(table.studentId, table.termId),
    index('academic_records_section_student_idx').on(table.courseSectionId, table.studentId),
    index('academic_records_source_idx').on(table.sourceAssignmentId, table.sourceReleaseVersion),
    index('academic_records_policy_version_idx').on(table.policyVersion),
    check('academic_records_record_version_positive', sql`${table.recordVersion} >= 1`),
    check('academic_records_credits_positive', sql`${table.credits} > 0`),
  ],
);
