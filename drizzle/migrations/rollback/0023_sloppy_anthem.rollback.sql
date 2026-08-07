ALTER TABLE "assignments" DROP CONSTRAINT IF EXISTS "assignments_section_id_course_sections_id_fk";
DROP INDEX IF EXISTS "assignments_section_id_status_idx";
ALTER TABLE "assignments" DROP COLUMN IF EXISTS "section_id";
ALTER TABLE "assignments" DROP COLUMN IF EXISTS "mode";
ALTER TABLE "assignments" DROP COLUMN IF EXISTS "status";

DROP TABLE IF EXISTS "section_enrollments";
DROP TABLE IF EXISTS "course_sections";
DROP TABLE IF EXISTS "courses";
DROP TABLE IF EXISTS "academic_terms";

DROP TYPE IF EXISTS "public"."section_enrollment_role";
DROP TYPE IF EXISTS "public"."course_section_status";
DROP TYPE IF EXISTS "public"."academic_term_status";
DROP TYPE IF EXISTS "public"."assignment_status";
DROP TYPE IF EXISTS "public"."assignment_mode";
