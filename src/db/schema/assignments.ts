import {
  pgTable,
  text,
  timestamp,
  serial,
  integer,
  pgEnum,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { assignmentTemplates, templateCheckpoints } from './templates';

export const checkpointState = pgEnum('checkpoint_state', [
  'locked',
  'unlocked',
  'submitted',
  'under_review',
  'passed',
  'revise',
]);

export const assignments = pgTable(
  'assignments',
  {
    id: serial('id').primaryKey(),
    templateId: integer('template_id')
      .notNull()
      .references(() => assignmentTemplates.id),
    title: text('title').notNull(),
    description: text('description'),
    finalDeadline: timestamp('final_deadline').notNull(),
    instructorId: text('instructor_id')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
    deletedAt: timestamp('deleted_at'),
    maxExtensionDays: integer('max_extension_days').default(7),
    maxTotalExtensions: integer('max_total_extensions').default(3),
  },
  (table) => [
    index('assignments_instructor_id_idx').on(table.instructorId),
    index('assignments_title_trgm_idx').using('gin', table.title.op('gin_trgm_ops')),
    check(
      'assignments_max_extension_days_range',
      sql`${table.maxExtensionDays} >= 1 AND ${table.maxExtensionDays} <= 30`,
    ),
    check(
      'assignments_max_total_extensions_range',
      sql`${table.maxTotalExtensions} >= 1 AND ${table.maxTotalExtensions} <= 10`,
    ),
  ],
);

export const assignmentStudents = pgTable(
  'assignment_students',
  {
    id: serial('id').primaryKey(),
    assignmentId: integer('assignment_id')
      .notNull()
      .references(() => assignments.id, { onDelete: 'cascade' }),
    studentId: text('student_id')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [
    index('assignment_students_assignment_id_student_id_idx').on(
      table.assignmentId,
      table.studentId,
    ),
    index('assignment_students_student_id_idx').on(table.studentId),
  ],
);

export const checkpoints = pgTable(
  'checkpoints',
  {
    id: serial('id').primaryKey(),
    assignmentId: integer('assignment_id')
      .notNull()
      .references(() => assignments.id, { onDelete: 'cascade' }),
    studentId: text('student_id')
      .notNull()
      .references(() => users.id),
    name: text('name').notNull(),
    order: integer('order').notNull(),
    dueDate: timestamp('due_date'),
    minConsultations: integer('min_consultations').default(0),
    state: checkpointState('state').notNull(),
    templateCheckpointId: integer('template_checkpoint_id').references(
      () => templateCheckpoints.id,
    ),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => [
    index('checkpoints_assignment_id_idx').on(table.assignmentId),
    index('checkpoints_student_id_idx').on(table.studentId),
    index('checkpoints_state_assignment_id_idx').on(table.state, table.assignmentId),
    index('checkpoints_template_checkpoint_id_idx').on(table.templateCheckpointId),
    index('checkpoints_state_due_date_idx').on(table.state, table.dueDate),
  ],
);
