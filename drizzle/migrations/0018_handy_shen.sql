CREATE TYPE "public"."intervention_action_type" AS ENUM('consultation', 'extension', 'discussion', 'other');--> statement-breakpoint
CREATE TYPE "public"."intervention_status" AS ENUM('open', 'monitoring', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TABLE "interventions" (
	"id" serial PRIMARY KEY NOT NULL,
	"assignment_id" integer NOT NULL,
	"student_id" text NOT NULL,
	"action_type" "intervention_action_type" NOT NULL,
	"private_note" text,
	"status" "intervention_status" DEFAULT 'open' NOT NULL,
	"follow_up_date" timestamp,
	"resolution_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "interventions" ADD CONSTRAINT "interventions_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interventions" ADD CONSTRAINT "interventions_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "interventions_assignment_id_status_idx" ON "interventions" USING btree ("assignment_id","status");--> statement-breakpoint
CREATE INDEX "interventions_assignment_id_student_id_idx" ON "interventions" USING btree ("assignment_id","student_id");--> statement-breakpoint
CREATE INDEX "interventions_follow_up_date_idx" ON "interventions" USING btree ("follow_up_date");--> statement-breakpoint
CREATE UNIQUE INDEX "interventions_active_assignment_student_idx" ON "interventions" USING btree ("assignment_id","student_id") WHERE "interventions"."status" IN ('open', 'monitoring');