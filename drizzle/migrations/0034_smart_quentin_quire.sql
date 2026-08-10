ALTER TABLE "risk_observations" DROP CONSTRAINT "risk_observations_source_event_consistency";--> statement-breakpoint
ALTER TABLE "risk_observations" ADD CONSTRAINT "risk_observations_source_event_consistency" CHECK ((
        "risk_observations"."retention_state" = 'anonymized'
        AND "risk_observations"."event_type" IS NULL
        AND "risk_observations"."source_event_id" IS NULL
      ) OR (
        "risk_observations"."source" = 'lifecycle_event'
        AND "risk_observations"."event_type" IS NOT NULL
        AND "risk_observations"."source_event_id" IS NOT NULL
      ) OR (
        "risk_observations"."source" = 'daily_snapshot'
        AND "risk_observations"."event_type" IS NULL
        AND "risk_observations"."source_event_id" IS NULL
      ));