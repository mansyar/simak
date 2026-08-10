ALTER TABLE "report_jobs" DROP CONSTRAINT "report_jobs_state_metadata_consistency";--> statement-breakpoint
ALTER TABLE "report_jobs" ADD CONSTRAINT "report_jobs_state_metadata_consistency" CHECK ((
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
        AND "report_jobs"."failure_code" IS NULL
        AND "report_jobs"."failure_message" IS NULL
        AND (
          (
            "report_jobs"."artifact_key" IS NULL
            AND "report_jobs"."artifact_size_bytes" IS NULL
            AND "report_jobs"."artifact_sha256" IS NULL
          ) OR (
            "report_jobs"."artifact_key" IS NOT NULL
            AND "report_jobs"."artifact_size_bytes" > 0
            AND "report_jobs"."artifact_sha256" IS NOT NULL
          )
        )
      ));