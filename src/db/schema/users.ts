import { pgTable, text, timestamp, boolean, pgEnum } from 'drizzle-orm/pg-core';

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
  twoFactorEnabled: boolean('two_factor_enabled').default(false),
});
