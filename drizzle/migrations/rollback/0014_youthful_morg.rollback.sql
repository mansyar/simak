-- Rollback for migration 0014: gradebook tables
-- final_grades is cache data (safe to drop); assignment_grade_config holds config (no user data loss).
DROP TABLE IF EXISTS "final_grades";
DROP TABLE IF EXISTS "assignment_grade_config";
DROP TYPE IF EXISTS "public"."final_grade_status";
DROP TYPE IF EXISTS "public"."grading_scheme";
