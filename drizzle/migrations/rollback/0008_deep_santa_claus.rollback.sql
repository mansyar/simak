-- Rollback for 0008_deep_santa_claus.sql
-- Reverts the PERF-7..14 index changes: drops the 9 new indexes and
-- recreates the 2 replaced single-column indexes.
-- Never auto-applied. Execute manually via psql or docker exec:
--   psql $DATABASE_URL < drizzle/migrations/rollback/0008_deep_santa_claus.rollback.sql

-- Drop the 9 indexes created by 0008
DROP INDEX IF EXISTS "assignment_students_assignment_id_student_id_idx";
DROP INDEX IF EXISTS "assignment_students_student_id_idx";
DROP INDEX IF EXISTS "notifications_created_at_idx";
DROP INDEX IF EXISTS "template_checkpoints_template_id_order_idx";
DROP INDEX IF EXISTS "users_role_deleted_at_idx";
DROP INDEX IF EXISTS "consultations_assignment_id_status_idx";
DROP INDEX IF EXISTS "extension_requests_assignment_id_student_id_idx";
DROP INDEX IF EXISTS "audit_log_actor_id_idx";
DROP INDEX IF EXISTS "reviews_submission_id_created_at_idx";

-- Recreate the 2 original indexes that 0008 dropped
CREATE INDEX "reviews_submission_id_idx" ON "reviews" USING btree ("submission_id");
CREATE INDEX "consultations_status_idx" ON "consultations" USING btree ("status");
