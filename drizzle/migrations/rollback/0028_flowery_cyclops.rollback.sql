DROP TABLE IF EXISTS "academic_records";
DROP TABLE IF EXISTS "academic_record_policies";
DROP INDEX IF EXISTS "assignments_section_transcript_source_idx";
ALTER TABLE "assignments" DROP COLUMN IF EXISTS "is_transcript_source";
ALTER TABLE "courses" DROP CONSTRAINT IF EXISTS "courses_credits_positive";
ALTER TABLE "courses" DROP COLUMN IF EXISTS "credits";
DROP TYPE IF EXISTS "academic_record_status";
