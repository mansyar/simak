CREATE TYPE "public"."risk_level" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."risk_lifecycle_event_type" AS ENUM('checkpoint_updated', 'submission_recorded', 'review_recorded', 'consultation_verified', 'intervention_updated');--> statement-breakpoint
CREATE TYPE "public"."risk_observation_retention_state" AS ENUM('identifiable', 'anonymized');--> statement-breakpoint
CREATE TYPE "public"."risk_observation_source" AS ENUM('lifecycle_event', 'daily_snapshot');--> statement-breakpoint
CREATE TABLE "risk_observations" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" "risk_observation_source" NOT NULL,
	"event_type" "risk_lifecycle_event_type",
	"source_event_id" text,
	"idempotency_key" text NOT NULL,
	"assignment_id" integer,
	"student_id" text,
	"checkpoint_id" integer,
	"intervention_id" integer,
	"academic_term_id" integer NOT NULL,
	"course_id" integer NOT NULL,
	"section_id" integer NOT NULL,
	"observed_at" timestamp NOT NULL,
	"algorithm_version" text NOT NULL,
	"risk_level" "risk_level" NOT NULL,
	"factor_snapshot" jsonb NOT NULL,
	"explanation_snapshot" jsonb NOT NULL,
	"retention_state" "risk_observation_retention_state" DEFAULT 'identifiable' NOT NULL,
	"anonymized_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "risk_observations_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "risk_observations_source_event_consistency" CHECK ((
        "risk_observations"."source" = 'lifecycle_event'
        AND "risk_observations"."event_type" IS NOT NULL
        AND "risk_observations"."source_event_id" IS NOT NULL
      ) OR (
        "risk_observations"."source" = 'daily_snapshot'
        AND "risk_observations"."event_type" IS NULL
        AND "risk_observations"."source_event_id" IS NULL
      )),
	CONSTRAINT "risk_observations_retention_anonymization_consistency" CHECK ((
        "risk_observations"."retention_state" = 'identifiable'
        AND "risk_observations"."student_id" IS NOT NULL
        AND "risk_observations"."assignment_id" IS NOT NULL
        AND "risk_observations"."anonymized_at" IS NULL
      ) OR (
        "risk_observations"."retention_state" = 'anonymized'
        AND "risk_observations"."student_id" IS NULL
        AND "risk_observations"."assignment_id" IS NULL
        AND "risk_observations"."checkpoint_id" IS NULL
        AND "risk_observations"."intervention_id" IS NULL
        AND "risk_observations"."source_event_id" IS NULL
        AND "risk_observations"."anonymized_at" IS NOT NULL
      ))
);
--> statement-breakpoint
ALTER TABLE "risk_observations" ADD CONSTRAINT "risk_observations_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_observations" ADD CONSTRAINT "risk_observations_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_observations" ADD CONSTRAINT "risk_observations_checkpoint_id_checkpoints_id_fk" FOREIGN KEY ("checkpoint_id") REFERENCES "public"."checkpoints"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_observations" ADD CONSTRAINT "risk_observations_intervention_id_interventions_id_fk" FOREIGN KEY ("intervention_id") REFERENCES "public"."interventions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_observations" ADD CONSTRAINT "risk_observations_academic_term_id_academic_terms_id_fk" FOREIGN KEY ("academic_term_id") REFERENCES "public"."academic_terms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_observations" ADD CONSTRAINT "risk_observations_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_observations" ADD CONSTRAINT "risk_observations_section_id_course_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."course_sections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "risk_observations_student_assignment_observed_at_idx" ON "risk_observations" USING btree ("student_id","assignment_id","observed_at");--> statement-breakpoint
CREATE INDEX "risk_observations_section_observed_at_idx" ON "risk_observations" USING btree ("section_id","observed_at");--> statement-breakpoint
CREATE INDEX "risk_observations_retention_idx" ON "risk_observations" USING btree ("retention_state","academic_term_id");