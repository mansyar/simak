ALTER TABLE "grade_release_snapshots" ALTER COLUMN "numeric_score" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "grade_release_snapshots" ALTER COLUMN "letter_grade" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "academic_records" ALTER COLUMN "source_release_version" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "academic_records" ALTER COLUMN "published_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "academic_records" ADD COLUMN "outcome_reason" text;--> statement-breakpoint
ALTER TABLE "academic_records" ADD COLUMN "outcome_actor_id" text;--> statement-breakpoint
ALTER TABLE "academic_records" ADD CONSTRAINT "academic_records_outcome_actor_id_users_id_fk" FOREIGN KEY ("outcome_actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grade_release_snapshots" ADD CONSTRAINT "grade_release_snapshots_published_outcome_check" CHECK ((
        ("grade_release_snapshots"."status" = 'complete' AND "grade_release_snapshots"."numeric_score" IS NOT NULL AND "grade_release_snapshots"."letter_grade" IS NOT NULL)
        OR ("grade_release_snapshots"."status" = 'incomplete' AND "grade_release_snapshots"."numeric_score" IS NULL AND "grade_release_snapshots"."letter_grade" IS NULL)
      ));--> statement-breakpoint
ALTER TABLE "academic_records" ADD CONSTRAINT "academic_records_complete_source_required" CHECK ("academic_records"."status" <> 'complete' OR (
        "academic_records"."source_snapshot_id" IS NOT NULL
        AND "academic_records"."source_release_version" IS NOT NULL
        AND "academic_records"."numeric_score" IS NOT NULL
        AND "academic_records"."letter_grade" IS NOT NULL
        AND "academic_records"."grade_points" IS NOT NULL
      ));--> statement-breakpoint
ALTER TABLE "academic_records" ADD CONSTRAINT "academic_records_non_complete_outcome_required" CHECK ("academic_records"."status" = 'complete' OR (
        "academic_records"."outcome_reason" IS NOT NULL
        AND "academic_records"."outcome_actor_id" IS NOT NULL
        AND "academic_records"."numeric_score" IS NULL
        AND "academic_records"."letter_grade" IS NULL
        AND "academic_records"."grade_points" IS NULL
      ));--> statement-breakpoint
ALTER TABLE "academic_records" ADD CONSTRAINT "academic_records_withdrawn_source_absent" CHECK ("academic_records"."status" <> 'withdrawn' OR "academic_records"."source_snapshot_id" IS NULL);--> statement-breakpoint
CREATE OR REPLACE FUNCTION "prevent_immutable_academic_data_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Academic data is append-only; UPDATE and DELETE are not permitted';
END;
$$;--> statement-breakpoint
CREATE TRIGGER "academic_records_immutable_trigger"
BEFORE UPDATE OR DELETE ON "academic_records"
FOR EACH ROW EXECUTE FUNCTION "prevent_immutable_academic_data_mutation"();--> statement-breakpoint
CREATE TRIGGER "academic_record_policies_immutable_trigger"
BEFORE UPDATE OR DELETE ON "academic_record_policies"
FOR EACH ROW EXECUTE FUNCTION "prevent_immutable_academic_data_mutation"();--> statement-breakpoint
CREATE TRIGGER "grade_release_snapshots_immutable_trigger"
BEFORE UPDATE OR DELETE ON "grade_release_snapshots"
FOR EACH ROW EXECUTE FUNCTION "prevent_immutable_academic_data_mutation"();--> statement-breakpoint
CREATE OR REPLACE FUNCTION "validate_academic_record_provenance"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  assignment_section_id integer;
  assignment_is_source boolean;
  section_course_id integer;
  section_term_id integer;
  snapshot_student_id text;
  snapshot_assignment_id integer;
  snapshot_release_version integer;
BEGIN
  SELECT "section_id", "is_transcript_source"
  INTO assignment_section_id, assignment_is_source
  FROM "assignments"
  WHERE "id" = NEW."source_assignment_id"
  FOR KEY SHARE;

  IF NOT FOUND
    OR assignment_section_id IS DISTINCT FROM NEW."course_section_id"
    OR assignment_is_source IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Academic record source assignment does not match its designated section';
  END IF;

  SELECT "course_id", "term_id"
  INTO section_course_id, section_term_id
  FROM "course_sections"
  WHERE "id" = NEW."course_section_id"
  FOR KEY SHARE;

  IF NOT FOUND
    OR section_course_id IS DISTINCT FROM NEW."course_id"
    OR section_term_id IS DISTINCT FROM NEW."term_id" THEN
    RAISE EXCEPTION 'Academic record course or term does not match its section';
  END IF;

  IF NEW."source_snapshot_id" IS NOT NULL THEN
    SELECT "student_id", "assignment_id", "release_version"
    INTO snapshot_student_id, snapshot_assignment_id, snapshot_release_version
    FROM "grade_release_snapshots"
    WHERE "id" = NEW."source_snapshot_id";

    IF NOT FOUND
      OR snapshot_student_id IS DISTINCT FROM NEW."student_id"
      OR snapshot_assignment_id IS DISTINCT FROM NEW."source_assignment_id"
      OR snapshot_release_version IS DISTINCT FROM NEW."source_release_version" THEN
      RAISE EXCEPTION 'Academic record snapshot provenance is inconsistent';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "academic_records" record
    INNER JOIN "assignments" assignment ON assignment."id" = record."source_assignment_id"
    INNER JOIN "course_sections" section ON section."id" = record."course_section_id"
    LEFT JOIN "grade_release_snapshots" snapshot ON snapshot."id" = record."source_snapshot_id"
    WHERE assignment."section_id" IS DISTINCT FROM record."course_section_id"
      OR assignment."is_transcript_source" IS DISTINCT FROM true
      OR section."course_id" IS DISTINCT FROM record."course_id"
      OR section."term_id" IS DISTINCT FROM record."term_id"
      OR (record."source_snapshot_id" IS NOT NULL AND (
        snapshot."id" IS NULL
        OR snapshot."student_id" IS DISTINCT FROM record."student_id"
        OR snapshot."assignment_id" IS DISTINCT FROM record."source_assignment_id"
        OR snapshot."release_version" IS DISTINCT FROM record."source_release_version"
      ))
  ) THEN
    RAISE EXCEPTION 'Existing academic-record provenance is inconsistent';
  END IF;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "academic_records_provenance_trigger"
BEFORE INSERT ON "academic_records"
FOR EACH ROW EXECUTE FUNCTION "validate_academic_record_provenance"();--> statement-breakpoint
CREATE OR REPLACE FUNCTION "prevent_transcript_source_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "academic_records"
    WHERE "source_assignment_id" = OLD."id"
  ) AND (
    NEW."is_transcript_source" IS DISTINCT FROM OLD."is_transcript_source"
    OR NEW."section_id" IS DISTINCT FROM OLD."section_id"
  ) THEN
    RAISE EXCEPTION 'Transcript source and section are immutable after official records exist';
  END IF;

  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "assignments_transcript_source_immutable_trigger"
BEFORE UPDATE OF "is_transcript_source", "section_id" ON "assignments"
FOR EACH ROW EXECUTE FUNCTION "prevent_transcript_source_mutation"();
