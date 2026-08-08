import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { users } from './users';
import { assignments, checkpoints } from './assignments';

export const appointmentStatus = pgEnum('appointment_status', [
  'available',
  'booked',
  'cancelled',
  'completed',
  'no_show',
]);

export const appointments = pgTable(
  'appointments',
  {
    id: serial('id').primaryKey(),
    assignmentId: integer('assignment_id')
      .notNull()
      .references(() => assignments.id, { onDelete: 'cascade' }),
    checkpointId: integer('checkpoint_id').references(() => checkpoints.id, {
      onDelete: 'cascade',
    }),
    instructorId: text('instructor_id')
      .notNull()
      .references(() => users.id),
    studentId: text('student_id').references(() => users.id),
    startAt: timestamp('start_at', { withTimezone: true }).notNull(),
    endAt: timestamp('end_at', { withTimezone: true }).notNull(),
    status: appointmentStatus('status').notNull().default('available'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('appointments_assignment_status_start_at_idx').on(
      table.assignmentId,
      table.status,
      table.startAt,
    ),
    index('appointments_instructor_status_start_at_idx').on(
      table.instructorId,
      table.status,
      table.startAt,
    ),
    index('appointments_student_status_start_at_idx').on(
      table.studentId,
      table.status,
      table.startAt,
    ),
    index('appointments_checkpoint_id_idx').on(table.checkpointId),
    check('appointments_time_order_check', sql`${table.startAt} < ${table.endAt}`),
    check(
      'appointments_duration_range_check',
      sql`${table.endAt} - ${table.startAt} >= INTERVAL '15 minutes' AND ${table.endAt} - ${table.startAt} <= INTERVAL '120 minutes'`,
    ),
    check(
      'appointments_status_student_check',
      sql`(${table.status} = 'available' AND ${table.studentId} IS NULL) OR (${table.status} IN ('booked', 'completed', 'no_show') AND ${table.studentId} IS NOT NULL) OR ${table.status} = 'cancelled'`,
    ),
  ],
);
