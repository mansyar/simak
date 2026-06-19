import { pgTable, serial, text, timestamp, integer, index } from 'drizzle-orm/pg-core';
import { users } from './users';
import { assignments } from './assignments';
import { checkpoints } from './assignments';
export const extensionRequests = pgTable(
  'extension_requests',
  {
    id: serial('id').primaryKey(),
    assignmentId: integer('assignment_id')
      .notNull()
      .references(() => assignments.id, { onDelete: 'cascade' }),
    studentId: text('student_id')
      .notNull()
      .references(() => users.id),
    checkpointId: integer('checkpoint_id').references(() => checkpoints.id),
    requestedDeadline: timestamp('requested_deadline').notNull(),
    reason: text('reason').notNull(),
    category: text('category', { enum: ['personal', 'research', 'health', 'other'] }).notNull(),
    extensionDays: integer('extension_days').notNull(),
    status: text('status', { enum: ['pending', 'approved', 'rejected'] }).notNull(),
    resolvedBy: text('resolved_by').references(() => users.id),
    resolutionReason: text('resolution_reason'),
    createdAt: timestamp('created_at').defaultNow(),
    resolvedAt: timestamp('resolved_at'),
  },
  (table) => [
    index('extension_requests_assignment_id_status_idx').on(table.assignmentId, table.status),
  ],
);
