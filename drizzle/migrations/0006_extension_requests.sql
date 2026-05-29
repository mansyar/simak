-- Create extension_requests table for deadline extension workflow
CREATE TABLE "extension_requests" (
	"id" serial PRIMARY KEY,
	"assignment_id" integer NOT NULL,
	"student_id" text NOT NULL,
	"checkpoint_id" integer,
	"requested_deadline" timestamp NOT NULL,
	"reason" text NOT NULL,
	"category" text NOT NULL,
	"extension_days" integer NOT NULL,
	"status" text NOT NULL,
	"resolved_by" text,
	"resolution_reason" text,
	"created_at" timestamp DEFAULT now(),
	"resolved_at" timestamp
);
--> statement-breakpoint
CREATE INDEX "extension_requests_assignment_id_status_idx" ON "extension_requests" ("assignment_id", "status");--> statement-breakpoint
ALTER TABLE "extension_requests" ADD CONSTRAINT "extension_requests_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extension_requests" ADD CONSTRAINT "extension_requests_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extension_requests" ADD CONSTRAINT "extension_requests_checkpoint_id_checkpoints_id_fk" FOREIGN KEY ("checkpoint_id") REFERENCES "public"."checkpoints"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extension_requests" ADD CONSTRAINT "extension_requests_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

-- Add max_extension_days and max_total_extensions columns to assignments table
ALTER TABLE "assignments" ADD COLUMN "max_extension_days" integer DEFAULT 7 NOT NULL;--> statement-breakpoint
ALTER TABLE "assignments" ADD COLUMN "max_total_extensions" integer DEFAULT 3 NOT NULL;
