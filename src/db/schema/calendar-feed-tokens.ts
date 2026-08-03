import { sql } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './users';

export const calendarFeedTokens = pgTable(
  'calendar_feed_tokens',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    studentId: text('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    revokedAt: timestamp('revoked_at'),
  },
  (table) => [
    index('calendar_feed_tokens_student_id_idx').on(table.studentId),
    uniqueIndex('calendar_feed_tokens_active_student_unq')
      .on(table.studentId)
      .where(sql`${table.revokedAt} IS NULL`),
  ],
);
