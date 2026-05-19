import {
  pgTable,
  text,
  timestamp,
  serial,
  boolean,
  pgEnum,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const userRole = pgEnum('user_role', ['superadmin', 'admin', 'instructor', 'student']);

export const users = pgTable('users', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  role: userRole('role').notNull(),
  locale: text('locale').default('en'),
  emailVerified: boolean('email_verified').default(false),
  image: text('image'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  deletedAt: timestamp('deleted_at'),
});

export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token: text('token').notNull().unique(),
    expiresAt: timestamp('expires_at').notNull(),
    used: boolean('used').default(false),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [uniqueIndex('password_reset_token_idx').on(table.token)],
);
