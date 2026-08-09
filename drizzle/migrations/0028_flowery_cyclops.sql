CREATE TYPE "public"."academic_record_status" AS ENUM('complete', 'incomplete', 'withdrawn');--> statement-breakpoint
CREATE TABLE "academic_record_policies" (
	"id" serial PRIMARY KEY NOT NULL,
	"version" integer NOT NULL,
	"effective_term_id" integer NOT NULL,
	"grade_points" jsonb NOT NULL,
	"rounding_scale" integer DEFAULT 2 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "academic_record_policies_version_unq" UNIQUE("version"),
	CONSTRAINT "academic_record_policies_rounding_scale_range" CHECK ("academic_record_policies"."rounding_scale" >= 0 AND "academic_record_policies"."rounding_scale" <= 4)
);
--> statement-breakpoint
CREATE TABLE "academic_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"course_id" integer NOT NULL,
	"course_section_id" integer NOT NULL,
	"term_id" integer NOT NULL,
	"source_assignment_id" integer NOT NULL,
	"source_snapshot_id" integer,
	"source_release_version" integer,
	"policy_version" integer NOT NULL,
	"record_version" integer NOT NULL,
	"numeric_score" numeric(5, 2),
	"letter_grade" text,
	"status" "academic_record_status" NOT NULL,
	"credits" numeric(5, 2) NOT NULL,
	"grade_points" numeric(4, 2),
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "academic_records_student_section_version_unq" UNIQUE("student_id","course_section_id","record_version"),
	CONSTRAINT "academic_records_record_version_positive" CHECK ("academic_records"."record_version" >= 1),
	CONSTRAINT "academic_records_credits_positive" CHECK ("academic_records"."credits" > 0)
);
--> statement-breakpoint
ALTER TABLE "assignments" ADD COLUMN "is_transcript_source" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "credits" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "academic_record_policies" ADD CONSTRAINT "academic_record_policies_effective_term_id_academic_terms_id_fk" FOREIGN KEY ("effective_term_id") REFERENCES "public"."academic_terms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academic_records" ADD CONSTRAINT "academic_records_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academic_records" ADD CONSTRAINT "academic_records_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academic_records" ADD CONSTRAINT "academic_records_course_section_id_course_sections_id_fk" FOREIGN KEY ("course_section_id") REFERENCES "public"."course_sections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academic_records" ADD CONSTRAINT "academic_records_term_id_academic_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "public"."academic_terms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academic_records" ADD CONSTRAINT "academic_records_source_assignment_id_assignments_id_fk" FOREIGN KEY ("source_assignment_id") REFERENCES "public"."assignments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academic_records" ADD CONSTRAINT "academic_records_source_snapshot_id_grade_release_snapshots_id_fk" FOREIGN KEY ("source_snapshot_id") REFERENCES "public"."grade_release_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academic_records" ADD CONSTRAINT "academic_records_policy_version_academic_record_policies_version_fk" FOREIGN KEY ("policy_version") REFERENCES "public"."academic_record_policies"("version") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "academic_record_policies_effective_term_idx" ON "academic_record_policies" USING btree ("effective_term_id","is_active");--> statement-breakpoint
CREATE INDEX "academic_records_student_term_idx" ON "academic_records" USING btree ("student_id","term_id");--> statement-breakpoint
CREATE INDEX "academic_records_section_student_idx" ON "academic_records" USING btree ("course_section_id","student_id");--> statement-breakpoint
CREATE INDEX "academic_records_source_idx" ON "academic_records" USING btree ("source_assignment_id","source_release_version");--> statement-breakpoint
CREATE INDEX "academic_records_policy_version_idx" ON "academic_records" USING btree ("policy_version");--> statement-breakpoint
CREATE UNIQUE INDEX "assignments_section_transcript_source_idx" ON "assignments" USING btree ("section_id") WHERE "assignments"."is_transcript_source" = true;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_credits_positive" CHECK ("courses"."credits" IS NULL OR "courses"."credits" > 0);
