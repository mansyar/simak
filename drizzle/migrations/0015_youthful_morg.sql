CREATE TYPE "public"."final_grade_status" AS ENUM('complete', 'incomplete', 'in_progress');--> statement-breakpoint
CREATE TYPE "public"."grading_scheme" AS ENUM('equal_weight', 'custom_weight');--> statement-breakpoint
CREATE TABLE "assignment_grade_config" (
	"assignment_id" integer NOT NULL,
	"grading_scheme" "grading_scheme" DEFAULT 'equal_weight' NOT NULL,
	"custom_weights" jsonb,
	"letter_grade_bounds" jsonb DEFAULT '{"A":90,"B":80,"C":70,"D":60}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "assignment_grade_config_assignment_id_unique" UNIQUE("assignment_id")
);
--> statement-breakpoint
CREATE TABLE "final_grades" (
	"id" serial PRIMARY KEY NOT NULL,
	"assignment_id" integer NOT NULL,
	"student_id" text NOT NULL,
	"numeric_score" numeric(5, 2),
	"letter_grade" text,
	"status" "final_grade_status" NOT NULL,
	"contributing_checkpoints" jsonb,
	"computed_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "final_grades_assignment_id_student_id_unq" UNIQUE("assignment_id","student_id")
);
--> statement-breakpoint
ALTER TABLE "assignment_grade_config" ADD CONSTRAINT "assignment_grade_config_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "final_grades" ADD CONSTRAINT "final_grades_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "final_grades" ADD CONSTRAINT "final_grades_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "final_grades_assignment_id_idx" ON "final_grades" USING btree ("assignment_id");--> statement-breakpoint
CREATE INDEX "final_grades_student_id_idx" ON "final_grades" USING btree ("student_id");--> statement-breakpoint

-- Backfill default grade config for pre-existing assignments
INSERT INTO "assignment_grade_config" ("assignment_id", "grading_scheme", "custom_weights", "letter_grade_bounds", "created_at", "updated_at")
SELECT a."id", 'equal_weight', NULL, '{"A":90,"B":80,"C":70,"D":60}'::jsonb, now(), now()
FROM "assignments" a
WHERE a."deleted_at" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "assignment_grade_config" agc WHERE agc."assignment_id" = a."id"
  );