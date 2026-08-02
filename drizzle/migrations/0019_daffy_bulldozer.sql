CREATE TYPE "public"."grade_release_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TABLE "grade_release_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"assignment_id" integer NOT NULL,
	"student_id" text NOT NULL,
	"release_version" integer NOT NULL,
	"numeric_score" numeric(5, 2) NOT NULL,
	"letter_grade" text NOT NULL,
	"status" "final_grade_status" NOT NULL,
	"contributing_checkpoints" jsonb NOT NULL,
	"published_at" timestamp NOT NULL,
	CONSTRAINT "grade_release_snapshots_assignment_version_student_unq" UNIQUE("assignment_id","release_version","student_id")
);
--> statement-breakpoint
ALTER TABLE "assignment_grade_config" ADD COLUMN "release_status" "grade_release_status" DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "assignment_grade_config" ADD COLUMN "active_release_version" integer;--> statement-breakpoint
ALTER TABLE "assignment_grade_config" ADD COLUMN "published_at" timestamp;--> statement-breakpoint
ALTER TABLE "grade_release_snapshots" ADD CONSTRAINT "grade_release_snapshots_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grade_release_snapshots" ADD CONSTRAINT "grade_release_snapshots_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "grade_release_snapshots_assignment_version_idx" ON "grade_release_snapshots" USING btree ("assignment_id","release_version");--> statement-breakpoint
CREATE INDEX "grade_release_snapshots_student_id_idx" ON "grade_release_snapshots" USING btree ("student_id");