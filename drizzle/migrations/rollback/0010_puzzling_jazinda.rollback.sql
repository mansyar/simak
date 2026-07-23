-- Rollback for 0010_puzzling_jazinda.sql
-- Reverses: grading_type enum, checkpoints.template_checkpoint_id column + backfill,
-- rubric_criteria, rubric_levels, review_scores tables.
-- Never auto-applied. Execute manually via psql or docker exec:
--   psql $DATABASE_URL < drizzle/migrations/rollback/0010_puzzling_jazinda.rollback.sql

-- Undo the backfill (clear populated template_checkpoint_id values).
UPDATE checkpoints SET template_checkpoint_id = NULL;

-- Drop FK on checkpoints.template_checkpoint_id
ALTER TABLE "checkpoints" DROP CONSTRAINT IF EXISTS "checkpoints_template_checkpoint_id_template_checkpoints_id_fk";

-- Drop the template_checkpoint_id column from checkpoints
ALTER TABLE "checkpoints" DROP COLUMN IF EXISTS "template_checkpoint_id";

-- Drop the grading_type column from template_checkpoints
ALTER TABLE "template_checkpoints" DROP COLUMN IF EXISTS "grading_type";

-- Drop indexes
DROP INDEX IF EXISTS "review_scores_review_id_idx";
DROP INDEX IF EXISTS "rubric_criteria_template_checkpoint_id_idx";
DROP INDEX IF EXISTS "rubric_levels_template_checkpoint_id_idx";

-- Drop FK constraints on review_scores
ALTER TABLE "review_scores" DROP CONSTRAINT IF EXISTS "review_scores_review_id_reviews_id_fk";
ALTER TABLE "review_scores" DROP CONSTRAINT IF EXISTS "review_scores_criterion_id_rubric_criteria_id_fk";
ALTER TABLE "review_scores" DROP CONSTRAINT IF EXISTS "review_scores_rubric_level_id_rubric_levels_id_fk";

-- Drop FK constraints on rubric_criteria and rubric_levels
ALTER TABLE "rubric_criteria" DROP CONSTRAINT IF EXISTS "rubric_criteria_template_checkpoint_id_template_checkpoints_id_fk";
ALTER TABLE "rubric_levels" DROP CONSTRAINT IF EXISTS "rubric_levels_template_checkpoint_id_template_checkpoints_id_fk";

-- Drop tables (review_scores first since it references rubric_criteria and rubric_levels)
DROP TABLE IF EXISTS "review_scores";
DROP TABLE IF EXISTS "rubric_criteria";
DROP TABLE IF EXISTS "rubric_levels";

-- Drop the grading_type enum
DROP TYPE IF EXISTS "grading_type";
