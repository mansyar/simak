-- Add estimated_duration column to template_checkpoints with default 0
ALTER TABLE "template_checkpoints" ADD COLUMN "estimated_duration" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint

-- Backfill existing template_checkpoints with estimated_duration = 14
UPDATE "template_checkpoints"
SET "estimated_duration" = 14
WHERE "estimated_duration" = 0;
--> statement-breakpoint

-- Backfill existing checkpoints.dueDate where NULL
-- Calculate as assignment.created_at + Σ(CP1..CPn.estimated_duration) days
-- Fallback to 14 days per checkpoint if template data is unavailable
UPDATE "checkpoints" cp
SET "due_date" = a."created_at" + (
  COALESCE((
    SELECT SUM(tc."estimated_duration")
    FROM "template_checkpoints" tc
    INNER JOIN "assignments" a2 ON a2."template_id" = tc."template_id"
    WHERE a2."id" = cp."assignment_id"
      AND tc."order" <= cp."order"
  ), cp."order" * 14) * INTERVAL '1 day'
)
FROM "assignments" a
WHERE cp."assignment_id" = a."id"
  AND cp."due_date" IS NULL;
