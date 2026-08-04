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
--> statement-breakpoint
DO $$
DECLARE
  extension_oid oid;
BEGIN
  SELECT oid
  INTO extension_oid
  FROM pg_extension
  WHERE extname = 'pg_trgm';

  IF extension_oid IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM pg_depend
      WHERE refobjid = extension_oid
        AND deptype NOT IN ('e', 'i')
    )
  THEN
    EXECUTE 'DROP EXTENSION IF EXISTS pg_trgm';
  END IF;
END $$;
