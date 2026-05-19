import { pgTable, text, timestamp, serial, integer, pgEnum, index } from 'drizzle-orm/pg-core';
import { users } from './users';
import { assignments } from './assignments';
import { checkpoints } from './assignments';

export const consultationStatus = pgEnum('consultation_status', [
  'pending',
  'verified',
  'rejected',
]);

export const consultations = pgTable(
  'consultations',
  {
    id: serial('id').primaryKey(),
    assignmentId: integer('assignment_id')
      .notNull()
      .references(() => assignments.id, { onDelete: 'cascade' }),
    checkpointId: integer('checkpoint_id')
      .notNull()
      .references(() => checkpoints.id, { onDelete: 'cascade' }),
    studentId: text('student_id')
      .notNull()
      .references(() => users.id),
    verifiedById: text('verified_by_id').references(() => users.id),
    status: consultationStatus('status').notNull(),
    notes: text('notes'),
    externalConsultantName: text('external_consultant_name'),
    sessionType: text('session_type'), // 'internal' | 'external'
    verifiedAt: timestamp('verified_at'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [
    index('consultations_checkpoint_id_idx').on(table.checkpointId),
    index('consultations_status_idx').on(table.status),
  ],
);
