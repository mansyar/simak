import {
  pgTable,
  text,
  timestamp,
  serial,
  integer,
  pgEnum,
  numeric,
  jsonb,
  unique,
  index,
} from 'drizzle-orm/pg-core';
import { assignments } from './assignments';
import { users } from './users';

export const gradingScheme = pgEnum('grading_scheme', ['equal_weight', 'custom_weight']);

export const finalGradeStatus = pgEnum('final_grade_status', [
  'complete',
  'incomplete',
  'in_progress',
]);

export const gradeReleaseStatus = pgEnum('grade_release_status', ['draft', 'published']);

/**
 * Per-assignment grade configuration.
 * Auto-created with defaults when an assignment is created (createDefaultGradeConfig).
 * Pre-existing assignments are backfilled by migration.
 */
export const assignmentGradeConfig = pgTable('assignment_grade_config', {
  assignmentId: integer('assignment_id')
    .notNull()
    .unique()
    .references(() => assignments.id, { onDelete: 'cascade' }),
  gradingScheme: gradingScheme('grading_scheme').notNull().default('equal_weight'),
  customWeights: jsonb('custom_weights'), // { [templateCheckpointId]: number } map, values 0–100
  letterGradeBounds: jsonb('letter_grade_bounds').notNull().default({ A: 90, B: 80, C: 70, D: 60 }),
  releaseStatus: gradeReleaseStatus('release_status').notNull().default('draft'),
  activeReleaseVersion: integer('active_release_version'),
  publishedAt: timestamp('published_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

/**
 * Cached final grade per student per assignment.
 * Upserted on-demand or when a review is submitted (recomputeStudentGrade).
 */
export const finalGrades = pgTable(
  'final_grades',
  {
    id: serial('id').primaryKey(),
    assignmentId: integer('assignment_id')
      .notNull()
      .references(() => assignments.id, { onDelete: 'cascade' }),
    studentId: text('student_id')
      .notNull()
      .references(() => users.id),
    numericScore: numeric('numeric_score', { precision: 5, scale: 2 }),
    letterGrade: text('letter_grade'),
    status: finalGradeStatus('status').notNull(),
    contributingCheckpoints: jsonb('contributing_checkpoints'), // array of { checkpointId, checkpointName, templateCheckpointId, order, state, score, isRubric, weight }
    computedAt: timestamp('computed_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => [
    unique('final_grades_assignment_id_student_id_unq').on(table.assignmentId, table.studentId),
    index('final_grades_assignment_id_idx').on(table.assignmentId),
    index('final_grades_student_id_idx').on(table.studentId),
  ],
);

/**
 * Immutable per-student grade values captured at publication time.
 * A new release version creates a new snapshot set rather than updating prior rows.
 */
export const gradeReleaseSnapshots = pgTable(
  'grade_release_snapshots',
  {
    id: serial('id').primaryKey(),
    assignmentId: integer('assignment_id')
      .notNull()
      .references(() => assignments.id, { onDelete: 'cascade' }),
    studentId: text('student_id')
      .notNull()
      .references(() => users.id),
    releaseVersion: integer('release_version').notNull(),
    numericScore: numeric('numeric_score', { precision: 5, scale: 2 }).notNull(),
    letterGrade: text('letter_grade').notNull(),
    status: finalGradeStatus('status').notNull(),
    contributingCheckpoints: jsonb('contributing_checkpoints').notNull(),
    publishedAt: timestamp('published_at').notNull(),
  },
  (table) => [
    unique('grade_release_snapshots_assignment_version_student_unq').on(
      table.assignmentId,
      table.releaseVersion,
      table.studentId,
    ),
    index('grade_release_snapshots_assignment_version_idx').on(
      table.assignmentId,
      table.releaseVersion,
    ),
    index('grade_release_snapshots_student_id_idx').on(table.studentId),
  ],
);
