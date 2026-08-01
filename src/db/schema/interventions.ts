import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { assignments } from './assignments';
import { users } from './users';

export const interventionActionType = pgEnum('intervention_action_type', [
  'consultation',
  'extension',
  'discussion',
  'other',
]);

export const interventionStatus = pgEnum('intervention_status', [
  'open',
  'monitoring',
  'resolved',
  'dismissed',
]);

export const interventions = pgTable(
  'interventions',
  {
    id: serial('id').primaryKey(),
    assignmentId: integer('assignment_id')
      .notNull()
      .references(() => assignments.id, { onDelete: 'cascade' }),
    studentId: text('student_id')
      .notNull()
      .references(() => users.id),
    actionType: interventionActionType('action_type').notNull(),
    privateNote: text('private_note'),
    status: interventionStatus('status').notNull().default('open'),
    followUpDate: timestamp('follow_up_date'),
    resolutionReason: text('resolution_reason'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('interventions_assignment_id_status_idx').on(table.assignmentId, table.status),
    index('interventions_assignment_id_student_id_idx').on(table.assignmentId, table.studentId),
    index('interventions_follow_up_date_idx').on(table.followUpDate),
    uniqueIndex('interventions_active_assignment_student_idx')
      .on(table.assignmentId, table.studentId)
      .where(sql`${table.status} IN ('open', 'monitoring')`),
  ],
);
