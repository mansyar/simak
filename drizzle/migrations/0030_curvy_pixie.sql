CREATE TYPE "public"."report_job_state" AS ENUM('pending', 'processing', 'completed', 'failed', 'expired');--> statement-breakpoint
CREATE TYPE "public"."report_locale" AS ENUM('en', 'id');--> statement-breakpoint
CREATE TYPE "public"."report_type" AS ENUM('institutional_academic_summary', 'official_transcript', 'analytics_summary');--> statement-breakpoint
CREATE TABLE "report_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"report_type" "report_type" NOT NULL,
	"requester_id" text NOT NULL,
	"parameters" jsonb NOT NULL,
	"locale" "report_locale" NOT NULL,
	"state" "report_job_state" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"artifact_key" text,
	"artifact_size_bytes" integer,
	"artifact_sha256" text,
	"failure_code" text,
	"failure_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"failed_at" timestamp,
	"expires_at" timestamp,
	CONSTRAINT "report_jobs_attempts_nonnegative" CHECK ("report_jobs"."attempts" >= 0),
	CONSTRAINT "report_jobs_state_metadata_consistency" CHECK ((
        "report_jobs"."state" = 'pending'
        AND "report_jobs"."started_at" IS NULL
        AND "report_jobs"."completed_at" IS NULL
        AND "report_jobs"."failed_at" IS NULL
        AND "report_jobs"."expires_at" IS NULL
        AND "report_jobs"."artifact_key" IS NULL
        AND "report_jobs"."artifact_size_bytes" IS NULL
        AND "report_jobs"."artifact_sha256" IS NULL
        AND "report_jobs"."failure_code" IS NULL
        AND "report_jobs"."failure_message" IS NULL
      ) OR (
        "report_jobs"."state" = 'processing'
        AND "report_jobs"."started_at" IS NOT NULL
        AND "report_jobs"."completed_at" IS NULL
        AND "report_jobs"."failed_at" IS NULL
        AND "report_jobs"."expires_at" IS NULL
        AND "report_jobs"."artifact_key" IS NULL
        AND "report_jobs"."artifact_size_bytes" IS NULL
        AND "report_jobs"."artifact_sha256" IS NULL
        AND "report_jobs"."failure_code" IS NULL
        AND "report_jobs"."failure_message" IS NULL
      ) OR (
        "report_jobs"."state" = 'completed'
        AND "report_jobs"."started_at" IS NOT NULL
        AND "report_jobs"."completed_at" IS NOT NULL
        AND "report_jobs"."failed_at" IS NULL
        AND "report_jobs"."expires_at" IS NOT NULL
        AND "report_jobs"."artifact_key" IS NOT NULL
        AND "report_jobs"."artifact_size_bytes" > 0
        AND "report_jobs"."artifact_sha256" IS NOT NULL
        AND "report_jobs"."failure_code" IS NULL
        AND "report_jobs"."failure_message" IS NULL
      ) OR (
        "report_jobs"."state" = 'failed'
        AND "report_jobs"."started_at" IS NOT NULL
        AND "report_jobs"."completed_at" IS NULL
        AND "report_jobs"."failed_at" IS NOT NULL
        AND "report_jobs"."expires_at" IS NULL
        AND "report_jobs"."artifact_key" IS NULL
        AND "report_jobs"."artifact_size_bytes" IS NULL
        AND "report_jobs"."artifact_sha256" IS NULL
        AND "report_jobs"."failure_code" IS NOT NULL
        AND "report_jobs"."failure_message" IS NOT NULL
      ) OR (
        "report_jobs"."state" = 'expired'
        AND "report_jobs"."started_at" IS NOT NULL
        AND "report_jobs"."completed_at" IS NOT NULL
        AND "report_jobs"."failed_at" IS NULL
        AND "report_jobs"."expires_at" IS NOT NULL
        AND "report_jobs"."artifact_key" IS NULL
        AND "report_jobs"."failure_code" IS NULL
        AND "report_jobs"."failure_message" IS NULL
      ))
);
--> statement-breakpoint
ALTER TABLE "report_jobs" ADD CONSTRAINT "report_jobs_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "report_jobs_state_created_at_idx" ON "report_jobs" USING btree ("state","created_at");--> statement-breakpoint
CREATE INDEX "report_jobs_requester_created_at_idx" ON "report_jobs" USING btree ("requester_id","created_at");--> statement-breakpoint
CREATE INDEX "report_jobs_expiry_idx" ON "report_jobs" USING btree ("state","expires_at");