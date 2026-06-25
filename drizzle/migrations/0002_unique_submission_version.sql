-- Defensively deduplicate any pre-existing rows that would violate the new
-- unique constraint. For each (checkpoint_id, version) pair, keep only one row
-- (the lowest id) and delete exact duplicates. Distinct versions (1, 2, 3 ...)
-- are preserved because submissions are append-only version history.
DELETE FROM "submissions"
WHERE "id" NOT IN (
  SELECT MIN("id") FROM "submissions"
  GROUP BY "checkpoint_id", "version"
);

ALTER TABLE "submissions" ADD CONSTRAINT "submissions_checkpoint_version_unq" UNIQUE ("checkpoint_id", "version");
