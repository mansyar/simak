import { pgTable, serial, text, timestamp, integer, index } from 'drizzle-orm/pg-core';

export const emailQueue = pgTable(
  'email_queue',
  {
    id: serial('id').primaryKey(),
    recipientEmail: text('recipient_email').notNull(),
    subject: text('subject').notNull(),
    bodyHtml: text('body_html').notNull(),
    templateType: text('template_type', {
      enum: [
        'password_reset',
        'invitation',
        'sla_alert',
        'two_factor',
        'submission_received',
        'review_completed',
        'revision_requested',
        'consultation_verified',
        'consultation_rejected',
        'extension_approved',
        'extension_rejected',
        'extension_requested',
        'deadline_reminder',
        'student_at_risk',
        'discussion_reply',
      ],
    }).notNull(),
    status: text('status', { enum: ['pending', 'processing', 'sent', 'failed'] }).notNull(),
    attempts: integer('attempts').default(0),
    lastAttemptAt: timestamp('last_attempt_at'),
    errorMessage: text('error_message'),
    resendMessageId: text('resend_message_id'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [
    index('email_queue_status_created_at_idx').on(table.status, table.createdAt),
    index('email_queue_recipient_email_trgm_idx').using(
      'gin',
      table.recipientEmail.op('gin_trgm_ops'),
    ),
    index('email_queue_subject_trgm_idx').using('gin', table.subject.op('gin_trgm_ops')),
  ],
);
