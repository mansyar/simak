-- Rollback for migration 0012_serious_nextwave.sql
-- Reverses: CREATE INDEX checkpoints_template_checkpoint_id_idx, review_scores_criterion_id_idx
DROP INDEX IF EXISTS "review_scores_criterion_id_idx";
DROP INDEX IF EXISTS "checkpoints_template_checkpoint_id_idx";
