import { pgTable, text, timestamp, serial, integer, index, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { templateCheckpoints } from './templates';
import { reviews } from './submissions';

export const rubricCriteria = pgTable(
  'rubric_criteria',
  {
    id: serial('id').primaryKey(),
    templateCheckpointId: integer('template_checkpoint_id')
      .notNull()
      .references(() => templateCheckpoints.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    weight: integer('weight').notNull(),
    order: integer('order').notNull(),
    deletedAt: timestamp('deleted_at'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [
    index('rubric_criteria_template_checkpoint_id_idx').on(table.templateCheckpointId),
    check('rubric_criteria_weight_range', sql`${table.weight} >= 0 AND ${table.weight} <= 100`),
  ],
);

export const rubricLevels = pgTable(
  'rubric_levels',
  {
    id: serial('id').primaryKey(),
    templateCheckpointId: integer('template_checkpoint_id')
      .notNull()
      .references(() => templateCheckpoints.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    description: text('description'),
    score: integer('score').notNull(),
    order: integer('order').notNull(),
    deletedAt: timestamp('deleted_at'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [
    index('rubric_levels_template_checkpoint_id_idx').on(table.templateCheckpointId),
    check('rubric_levels_score_range', sql`${table.score} >= 0 AND ${table.score} <= 100`),
  ],
);

export const reviewScores = pgTable(
  'review_scores',
  {
    id: serial('id').primaryKey(),
    reviewId: integer('review_id')
      .notNull()
      .references(() => reviews.id, { onDelete: 'cascade' }),
    criterionId: integer('criterion_id')
      .notNull()
      .references(() => rubricCriteria.id),
    criterionTitle: text('criterion_title').notNull(),
    score: integer('score').notNull(),
    weight: integer('weight').notNull(),
    rubricLevelId: integer('rubric_level_id').references(() => rubricLevels.id),
    levelLabel: text('level_label'),
    comment: text('comment'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [index('review_scores_review_id_idx').on(table.reviewId)],
);
