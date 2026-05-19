import { pgTable, text, timestamp, serial, integer, index } from 'drizzle-orm/pg-core';
import { users } from './users';
import { checkpoints } from './assignments';

export const submissions = pgTable(
  'submissions',
  {
    id: serial('id').primaryKey(),
    checkpointId: integer('checkpoint_id')
      .notNull()
      .references(() => checkpoints.id, { onDelete: 'cascade' }),
    uploadedBy: text('uploaded_by')
      .notNull()
      .references(() => users.id),
    fileKey: text('file_key').notNull(),
    fileName: text('file_name').notNull(),
    fileSize: integer('file_size').notNull(),
    version: integer('version').default(1),
    uploadedAt: timestamp('uploaded_at').defaultNow(),
  },
  (table) => [
    index('submissions_checkpoint_id_idx').on(table.checkpointId),
    index('submissions_uploaded_by_idx').on(table.uploadedBy),
  ],
);

export const reviews = pgTable(
  'reviews',
  {
    id: serial('id').primaryKey(),
    submissionId: integer('submission_id')
      .notNull()
      .references(() => submissions.id, { onDelete: 'cascade' }),
    instructorId: text('instructor_id')
      .notNull()
      .references(() => users.id),
    decision: text('decision').notNull(), // 'pass' | 'revise'
    comment: text('comment'),
    feedbackFileKey: text('feedback_file_key'),
    revisionDeadline: timestamp('revision_deadline'),
    createdAt: timestamp('created_at').defaultNow(),
    reviewedAt: timestamp('reviewed_at'),
  },
  (table) => [index('reviews_submission_id_idx').on(table.submissionId)],
);
