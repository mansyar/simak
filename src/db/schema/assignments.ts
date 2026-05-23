import { pgTable, text, timestamp, serial, integer, pgEnum, index } from 'drizzle-orm/pg-core';
import { users } from './users';
import { assignmentTemplates } from './templates';

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
  },
  (table) => [index('assignments_instructor_id_idx').on(table.instructorId)],
);

export const assignmentStudents = pgTable('assignment_students', {
  id: serial('id').primaryKey(),
  assignmentId: integer('assignment_id')
    .notNull()
    .references(() => assignments.id, { onDelete: 'cascade' }),
  studentId: text('student_id')
    .notNull()
    .references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
});

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
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => [
    index('checkpoints_assignment_id_idx').on(table.assignmentId),
    index('checkpoints_student_id_idx').on(table.studentId),
    index('checkpoints_state_assignment_id_idx').on(table.state, table.assignmentId),
  ],
);
