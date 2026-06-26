-- Backfill existing notifications so legacy title/message text remains visible
-- after the contract migration drops the old columns.
UPDATE notifications
SET title_key = title,
    message_key = message,
    params = '{}'::jsonb
WHERE title_key IS NULL;
