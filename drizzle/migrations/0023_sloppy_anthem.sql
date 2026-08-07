DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "assignments") THEN
    RAISE EXCEPTION 'TRACK-057 prelaunch migration requires an empty assignments table; legacy academic context cannot be fabricated';
  END IF;
END $$;--> statement-breakpoint
CREATE TYPE "public"."assignment_mode" AS ENUM('individual', 'group');--> statement-breakpoint
CREATE TYPE "public"."assignment_status" AS ENUM('draft', 'active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."academic_term_status" AS ENUM('draft', 'active', 'closed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."course_section_status" AS ENUM('active', 'inactive', 'archived');--> statement-breakpoint
CREATE TYPE "public"."section_enrollment_role" AS ENUM('instructor', 'student');--> statement-breakpoint
CREATE TABLE "academic_terms" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"status" "academic_term_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"archived_at" timestamp,
	CONSTRAINT "academic_terms_code_unq" UNIQUE("code"),
	CONSTRAINT "academic_terms_date_range" CHECK ("academic_terms"."start_date" <= "academic_terms"."end_date")
);
--> statement-breakpoint
CREATE TABLE "course_sections" (
	"id" serial PRIMARY KEY NOT NULL,
	"term_id" integer NOT NULL,
	"course_id" integer NOT NULL,
	"code" text NOT NULL,
	"name" text,
	"status" "course_section_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"archived_at" timestamp,
	CONSTRAINT "course_sections_term_course_code_unq" UNIQUE("term_id","course_id","code")
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"archived_at" timestamp,
	CONSTRAINT "courses_code_unq" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "section_enrollments" (
	"id" serial PRIMARY KEY NOT NULL,
	"section_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"role" "section_enrollment_role" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "section_enrollments_section_user_unq" UNIQUE("section_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "assignments" ADD COLUMN "section_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "assignments" ADD COLUMN "mode" "assignment_mode" DEFAULT 'individual' NOT NULL;--> statement-breakpoint
ALTER TABLE "assignments" ADD COLUMN "status" "assignment_status" DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "course_sections" ADD CONSTRAINT "course_sections_term_id_academic_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "public"."academic_terms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_sections" ADD CONSTRAINT "course_sections_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section_enrollments" ADD CONSTRAINT "section_enrollments_section_id_course_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."course_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section_enrollments" ADD CONSTRAINT "section_enrollments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "academic_terms_status_idx" ON "academic_terms" USING btree ("status");--> statement-breakpoint
CREATE INDEX "course_sections_term_course_idx" ON "course_sections" USING btree ("term_id","course_id");--> statement-breakpoint
CREATE INDEX "course_sections_status_idx" ON "course_sections" USING btree ("status");--> statement-breakpoint
CREATE INDEX "section_enrollments_section_role_active_idx" ON "section_enrollments" USING btree ("section_id","role","is_active");--> statement-breakpoint
CREATE INDEX "section_enrollments_user_role_active_idx" ON "section_enrollments" USING btree ("user_id","role","is_active");--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_section_id_course_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."course_sections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assignments_section_id_status_idx" ON "assignments" USING btree ("section_id","status");
