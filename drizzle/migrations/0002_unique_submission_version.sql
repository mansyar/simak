-- Defensively deduplicate any pre-existing rows that would violate the new
-- unique constraint. For each checkpoint, keep only the row with the maximum
-- version before adding UNIQUE (checkpoint_id, version).
DELETE FROM "submissions"
WHERE "id" NOT IN (
  SELECT DISTINCT ON ("checkpoint_id") "id"
  FROM "submissions"
  ORDER BY "checkpoint_id" ASC, "version" DESC, "id" DESC
);

ALTER TABLE "submissions" ADD CONSTRAINT "submissions_checkpoint_version_unq" UNIQUE ("checkpoint_id", "version");
