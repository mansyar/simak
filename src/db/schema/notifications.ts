import { pgTable, text, timestamp, serial, boolean, jsonb, index } from 'drizzle-orm/pg-core';
import { users } from './users';

export const notifications = pgTable(
  'notifications',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    title: text('title').notNull(),
    message: text('message'),
    read: boolean('read').default(false),
    channel: text('channel').notNull(), // 'in_app' | 'email'
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [index('notifications_user_id_read_idx').on(table.userId, table.read)],
);
