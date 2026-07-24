import { pgTable, serial, text, timestamp, integer, unique } from 'drizzle-orm/pg-core';
import { checkpoints } from './assignments';
import { users } from './users';

export const deadlineReminders = pgTable(
  'deadline_reminders',
  {
    id: serial('id').primaryKey(),
    checkpointId: integer('checkpoint_id')
      .notNull()
      .references(() => checkpoints.id, { onDelete: 'cascade' }),
    studentId: text('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tier: text('tier').notNull(),
    sentAt: timestamp('sent_at').defaultNow(),
  },
  (table) => [
    unique('deadline_reminders_checkpoint_id_tier_unq').on(table.checkpointId, table.tier),
  ],
);
