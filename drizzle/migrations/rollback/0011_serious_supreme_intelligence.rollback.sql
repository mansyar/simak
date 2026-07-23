-- Rollback for migration 0011_serious_supreme_intelligence.sql
-- Reverses: ALTER TABLE "template_checkpoints" ADD COLUMN "deleted_at" timestamp;
ALTER TABLE "template_checkpoints" DROP COLUMN IF EXISTS "deleted_at";
