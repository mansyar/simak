import { pgTable, text, timestamp, boolean, jsonb, pgEnum, index } from 'drizzle-orm/pg-core';

export const userRole = pgEnum('user_role', ['superadmin', 'admin', 'instructor', 'student']);

export type UserSettings = {
  reducedMotion: boolean;
  timezone?: string;
  notificationPrefs?: Record<string, { email?: boolean; inApp?: boolean }>;
};

export const users = pgTable(
  'users',
  {
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
    settings: jsonb('settings').$type<UserSettings>(),
  },
  (table) => [
    index('users_role_deleted_at_idx').on(table.role, table.deletedAt),
    index('users_name_trgm_idx').using('gin', table.name.op('gin_trgm_ops')),
    index('users_email_trgm_idx').using('gin', table.email.op('gin_trgm_ops')),
  ],
);
