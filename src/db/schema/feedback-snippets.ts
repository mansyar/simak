import { pgTable, text, timestamp, varchar, index } from 'drizzle-orm/pg-core';
import { users } from './users';

export const feedbackSnippets = pgTable(
  'feedback_snippets',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    instructorId: text('instructor_id')
      .notNull()
      .references(() => users.id),
    title: varchar('title', { length: 100 }).notNull(),
    category: varchar('category', { length: 50 }),
    body: varchar('body', { length: 2000 }).notNull(),
    archivedAt: timestamp('archived_at'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => [
    index('feedback_snippets_instructor_archived_idx').on(table.instructorId, table.archivedAt),
  ],
);
