import {
  pgTable,
  text,
  timestamp,
  serial,
  integer,
  index,
  pgEnum,
  unique,
} from 'drizzle-orm/pg-core';
import { users } from './users';
import { checkpoints } from './assignments';

export const reviewDecision = pgEnum('review_decision', ['pass', 'revise']);

export const uploadPurpose = pgEnum('upload_purpose', ['submission', 'review_feedback']);

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
    unique('submissions_checkpoint_version_unq').on(table.checkpointId, table.version),
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
    decision: reviewDecision('decision').notNull(),
    comment: text('comment'),
    feedbackFileKey: text('feedback_file_key'),
    revisionDeadline: timestamp('revision_deadline'),
    createdAt: timestamp('created_at').defaultNow(),
    reviewedAt: timestamp('reviewed_at'),
  },
  (table) => [
    index('reviews_submission_id_created_at_idx').on(table.submissionId, table.createdAt),
  ],
);

export const uploadIntents = pgTable(
  'upload_intents',
  {
    fileKey: text('file_key').notNull().unique(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    purpose: uploadPurpose('purpose').notNull(),
    checkpointId: integer('checkpoint_id').references(() => checkpoints.id, {
      onDelete: 'cascade',
    }),
    fileName: text('file_name'),
    fileSize: integer('file_size'),
    contentType: text('content_type').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    consumedAt: timestamp('consumed_at'),
    cleanedUpAt: timestamp('cleaned_up_at'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [
    index('upload_intents_user_id_idx').on(table.userId),
    index('upload_intents_file_key_idx').on(table.fileKey),
  ],
);
