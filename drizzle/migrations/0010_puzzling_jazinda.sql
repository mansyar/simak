CREATE TYPE "public"."grading_type" AS ENUM('numeric', 'qualitative');--> statement-breakpoint
CREATE TABLE "review_scores" (
	"id" serial PRIMARY KEY NOT NULL,
	"review_id" integer NOT NULL,
	"criterion_id" integer NOT NULL,
	"criterion_title" text NOT NULL,
	"score" integer NOT NULL,
	"weight" integer NOT NULL,
	"rubric_level_id" integer,
	"level_label" text,
	"comment" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "rubric_criteria" (
	"id" serial PRIMARY KEY NOT NULL,
	"template_checkpoint_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"weight" integer NOT NULL,
	"order" integer NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "rubric_criteria_weight_range" CHECK ("rubric_criteria"."weight" >= 0 AND "rubric_criteria"."weight" <= 100)
);
--> statement-breakpoint
CREATE TABLE "rubric_levels" (
	"id" serial PRIMARY KEY NOT NULL,
	"template_checkpoint_id" integer NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"score" integer NOT NULL,
	"order" integer NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "rubric_levels_score_range" CHECK ("rubric_levels"."score" >= 0 AND "rubric_levels"."score" <= 100)
);
--> statement-breakpoint
ALTER TABLE "template_checkpoints" ADD COLUMN "grading_type" "grading_type";--> statement-breakpoint
ALTER TABLE "checkpoints" ADD COLUMN "template_checkpoint_id" integer;--> statement-breakpoint
ALTER TABLE "review_scores" ADD CONSTRAINT "review_scores_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_scores" ADD CONSTRAINT "review_scores_criterion_id_rubric_criteria_id_fk" FOREIGN KEY ("criterion_id") REFERENCES "public"."rubric_criteria"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_scores" ADD CONSTRAINT "review_scores_rubric_level_id_rubric_levels_id_fk" FOREIGN KEY ("rubric_level_id") REFERENCES "public"."rubric_levels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rubric_criteria" ADD CONSTRAINT "rubric_criteria_template_checkpoint_id_template_checkpoints_id_fk" FOREIGN KEY ("template_checkpoint_id") REFERENCES "public"."template_checkpoints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rubric_levels" ADD CONSTRAINT "rubric_levels_template_checkpoint_id_template_checkpoints_id_fk" FOREIGN KEY ("template_checkpoint_id") REFERENCES "public"."template_checkpoints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "review_scores_review_id_idx" ON "review_scores" USING btree ("review_id");--> statement-breakpoint
CREATE INDEX "rubric_criteria_template_checkpoint_id_idx" ON "rubric_criteria" USING btree ("template_checkpoint_id");--> statement-breakpoint
CREATE INDEX "rubric_levels_template_checkpoint_id_idx" ON "rubric_levels" USING btree ("template_checkpoint_id");--> statement-breakpoint
ALTER TABLE "checkpoints" ADD CONSTRAINT "checkpoints_template_checkpoint_id_template_checkpoints_id_fk" FOREIGN KEY ("template_checkpoint_id") REFERENCES "public"."template_checkpoints"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Backfill checkpoints.template_checkpoint_id for existing rows.
-- Matches via assignments.templateId + order to template_checkpoints.
UPDATE checkpoints
SET template_checkpoint_id = tc.id
FROM assignments a, template_checkpoints tc
WHERE checkpoints.assignment_id = a.id
  AND tc.template_id = a.template_id
  AND tc."order" = checkpoints."order";