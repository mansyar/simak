-- ROLLBACK NOT POSSIBLE: data loss irreversible
DROP TABLE IF EXISTS "grade_release_snapshots";
ALTER TABLE "assignment_grade_config"
  DROP COLUMN IF EXISTS "published_at",
  DROP COLUMN IF EXISTS "active_release_version",
  DROP COLUMN IF EXISTS "release_status";
DROP TYPE IF EXISTS "public"."grade_release_status";
