DROP INDEX IF EXISTS "public"."appointments_checkpoint_id_idx";
DROP INDEX IF EXISTS "public"."appointments_assignment_status_start_at_idx";
DROP INDEX IF EXISTS "public"."appointments_instructor_status_start_at_idx";
DROP INDEX IF EXISTS "public"."appointments_student_status_start_at_idx";
DROP TABLE IF EXISTS "appointments";
DROP TYPE IF EXISTS "public"."appointment_status";
