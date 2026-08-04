DROP INDEX IF EXISTS "users_name_trgm_idx";
DROP INDEX IF EXISTS "users_email_trgm_idx";
DROP INDEX IF EXISTS "assignment_templates_name_trgm_idx";
DROP INDEX IF EXISTS "assignments_title_trgm_idx";
DROP INDEX IF EXISTS "audit_log_entity_id_trgm_idx";
DROP INDEX IF EXISTS "audit_log_details_trgm_idx";
DROP INDEX IF EXISTS "email_queue_recipient_email_trgm_idx";
DROP INDEX IF EXISTS "email_queue_subject_trgm_idx";
DROP INDEX IF EXISTS "feedback_snippets_title_trgm_idx";
DROP INDEX IF EXISTS "feedback_snippets_category_trgm_idx";

-- CREATE EXTENSION IF NOT EXISTS cannot establish ownership. Retain pg_trgm
-- because it may predate this migration or be required by other indexes.
