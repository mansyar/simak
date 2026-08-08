import {
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';
import { appointments } from './appointments';
import { users } from './users';

export const appointmentReminderTier = pgEnum('appointment_reminder_tier', ['24h', '1h']);

export const appointmentReminders = pgTable(
  'appointment_reminders',
  {
    id: serial('id').primaryKey(),
    appointmentId: integer('appointment_id')
      .notNull()
      .references(() => appointments.id, { onDelete: 'cascade' }),
    participantId: text('participant_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tier: appointmentReminderTier('tier').notNull(),
    claimedAt: timestamp('claimed_at', { withTimezone: true }).defaultNow().notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }),
  },
  (table) => [
    unique('appointment_reminders_appointment_participant_tier_unq').on(
      table.appointmentId,
      table.participantId,
      table.tier,
    ),
    index('appointment_reminders_appointment_tier_idx').on(table.appointmentId, table.tier),
    index('appointment_reminders_participant_tier_idx').on(table.participantId, table.tier),
  ],
);
