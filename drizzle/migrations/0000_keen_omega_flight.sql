CREATE TYPE "public"."user_role" AS ENUM('superadmin', 'admin', 'instructor', 'student');--> statement-breakpoint
CREATE TYPE "public"."checkpoint_state" AS ENUM('locked', 'unlocked', 'submitted', 'under_review', 'passed', 'revise');--> statement-breakpoint
CREATE TYPE "public"."review_decision" AS ENUM('pass', 'revise');--> statement-breakpoint
CREATE TYPE "public"."consultation_session_type" AS ENUM('internal', 'external');--> statement-breakpoint
CREATE TYPE "public"."consultation_status" AS ENUM('pending', 'verified', 'rejected');--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"role" "user_role" NOT NULL,
	"locale" text DEFAULT 'en',
	"email_verified" boolean DEFAULT false,
	"image" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"deleted_at" timestamp,
	"two_factor_enabled" boolean DEFAULT false,
	"settings" jsonb,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"password" text,
	"access_token" text,
	"refresh_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"id_token" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "two_factor" (
	"id" text PRIMARY KEY NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"verified" boolean DEFAULT true,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "assignment_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "template_checkpoints" (
	"id" serial PRIMARY KEY NOT NULL,
	"template_id" integer NOT NULL,
	"name" text NOT NULL,
	"order" integer NOT NULL,
	"min_consultations" integer DEFAULT 0,
	"estimated_duration" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "assignment_students" (
	"id" serial PRIMARY KEY NOT NULL,
	"assignment_id" integer NOT NULL,
	"student_id" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"template_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"final_deadline" timestamp NOT NULL,
	"instructor_id" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"deleted_at" timestamp,
	"max_extension_days" integer DEFAULT 7,
	"max_total_extensions" integer DEFAULT 3,
	CONSTRAINT "assignments_max_extension_days_range" CHECK ("assignments"."max_extension_days" >= 1 AND "assignments"."max_extension_days" <= 30),
	CONSTRAINT "assignments_max_total_extensions_range" CHECK ("assignments"."max_total_extensions" >= 1 AND "assignments"."max_total_extensions" <= 10)
);
--> statement-breakpoint
CREATE TABLE "checkpoints" (
	"id" serial PRIMARY KEY NOT NULL,
	"assignment_id" integer NOT NULL,
	"student_id" text NOT NULL,
	"name" text NOT NULL,
	"order" integer NOT NULL,
	"due_date" timestamp,
	"min_consultations" integer DEFAULT 0,
	"state" "checkpoint_state" NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"submission_id" integer NOT NULL,
	"instructor_id" text NOT NULL,
	"decision" "review_decision" NOT NULL,
	"comment" text,
	"feedback_file_key" text,
	"revision_deadline" timestamp,
	"created_at" timestamp DEFAULT now(),
	"reviewed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"checkpoint_id" integer NOT NULL,
	"uploaded_by" text NOT NULL,
	"file_key" text NOT NULL,
	"file_name" text NOT NULL,
	"file_size" integer NOT NULL,
	"version" integer DEFAULT 1,
	"uploaded_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "consultations" (
	"id" serial PRIMARY KEY NOT NULL,
	"assignment_id" integer NOT NULL,
	"checkpoint_id" integer NOT NULL,
	"student_id" text NOT NULL,
	"verified_by_id" text,
	"status" "consultation_status" NOT NULL,
	"notes" text,
	"external_consultant_name" text,
	"session_type" "consultation_session_type",
	"verified_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"message" text,
	"read" boolean DEFAULT false,
	"channel" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_id" text NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"details" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "extension_requests" (
	"id" serial PRIMARY KEY NOT NULL,
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
CREATE TABLE "email_queue" (
	"id" serial PRIMARY KEY NOT NULL,
	"recipient_email" text NOT NULL,
	"subject" text NOT NULL,
	"body_html" text NOT NULL,
	"template_type" text NOT NULL,
	"status" text NOT NULL,
	"attempts" integer DEFAULT 0,
	"last_attempt_at" timestamp,
	"error_message" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "two_factor" ADD CONSTRAINT "two_factor_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_templates" ADD CONSTRAINT "assignment_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_checkpoints" ADD CONSTRAINT "template_checkpoints_template_id_assignment_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."assignment_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_students" ADD CONSTRAINT "assignment_students_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_students" ADD CONSTRAINT "assignment_students_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_template_id_assignment_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."assignment_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_instructor_id_users_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkpoints" ADD CONSTRAINT "checkpoints_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkpoints" ADD CONSTRAINT "checkpoints_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_instructor_id_users_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_checkpoint_id_checkpoints_id_fk" FOREIGN KEY ("checkpoint_id") REFERENCES "public"."checkpoints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_checkpoint_id_checkpoints_id_fk" FOREIGN KEY ("checkpoint_id") REFERENCES "public"."checkpoints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_verified_by_id_users_id_fk" FOREIGN KEY ("verified_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extension_requests" ADD CONSTRAINT "extension_requests_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extension_requests" ADD CONSTRAINT "extension_requests_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extension_requests" ADD CONSTRAINT "extension_requests_checkpoint_id_checkpoints_id_fk" FOREIGN KEY ("checkpoint_id") REFERENCES "public"."checkpoints"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extension_requests" ADD CONSTRAINT "extension_requests_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "twoFactor_secret_idx" ON "two_factor" USING btree ("secret");--> statement-breakpoint
CREATE INDEX "twoFactor_userId_idx" ON "two_factor" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "assignments_instructor_id_idx" ON "assignments" USING btree ("instructor_id");--> statement-breakpoint
CREATE INDEX "checkpoints_assignment_id_idx" ON "checkpoints" USING btree ("assignment_id");--> statement-breakpoint
CREATE INDEX "checkpoints_student_id_idx" ON "checkpoints" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "checkpoints_state_assignment_id_idx" ON "checkpoints" USING btree ("state","assignment_id");--> statement-breakpoint
CREATE INDEX "reviews_submission_id_idx" ON "reviews" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "submissions_checkpoint_id_idx" ON "submissions" USING btree ("checkpoint_id");--> statement-breakpoint
CREATE INDEX "submissions_uploaded_by_idx" ON "submissions" USING btree ("uploaded_by");--> statement-breakpoint
CREATE INDEX "consultations_checkpoint_id_idx" ON "consultations" USING btree ("checkpoint_id");--> statement-breakpoint
CREATE INDEX "consultations_status_idx" ON "consultations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "notifications_user_id_read_idx" ON "notifications" USING btree ("user_id","read");--> statement-breakpoint
CREATE INDEX "audit_log_created_at_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_log_action_idx" ON "audit_log" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_log_entity_type_entity_id_idx" ON "audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "extension_requests_assignment_id_status_idx" ON "extension_requests" USING btree ("assignment_id","status");--> statement-breakpoint
CREATE INDEX "email_queue_status_created_at_idx" ON "email_queue" USING btree ("status","created_at");