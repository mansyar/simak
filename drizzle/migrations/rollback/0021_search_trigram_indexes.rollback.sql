DROP INDEX IF EXISTS "audit_log_details_trgm_idx";
DROP INDEX IF EXISTS "audit_log_entity_id_trgm_idx";
DROP INDEX IF EXISTS "feedback_snippets_category_trgm_idx";
DROP INDEX IF EXISTS "feedback_snippets_title_trgm_idx";
DROP INDEX IF EXISTS "assignments_title_trgm_idx";
DROP INDEX IF EXISTS "email_queue_subject_trgm_idx";
DROP INDEX IF EXISTS "email_queue_recipient_email_trgm_idx";
DROP INDEX IF EXISTS "assignment_templates_name_trgm_idx";
DROP INDEX IF EXISTS "users_email_trgm_idx";
DROP INDEX IF EXISTS "users_name_trgm_idx";
-- pg_trgm is intentionally retained. CREATE EXTENSION IF NOT EXISTS cannot
-- establish ownership, so removing it during rollback could break indexes
-- or operators created by another migration or deployment.
