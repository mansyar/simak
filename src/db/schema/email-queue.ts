import { pgTable, serial, text, timestamp, integer, index } from 'drizzle-orm/pg-core';

export const emailQueue = pgTable(
  'email_queue',
  {
    id: serial('id').primaryKey(),
    recipientEmail: text('recipient_email').notNull(),
    subject: text('subject').notNull(),
    bodyHtml: text('body_html').notNull(),
    templateType: text('template_type', {
      enum: ['password_reset', 'invitation', 'sla_alert', 'two_factor'],
    }).notNull(),
    status: text('status', { enum: ['pending', 'processing', 'sent', 'failed'] }).notNull(),
    attempts: integer('attempts').default(0),
    lastAttemptAt: timestamp('last_attempt_at'),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [index('email_queue_status_created_at_idx').on(table.status, table.createdAt)],
);
