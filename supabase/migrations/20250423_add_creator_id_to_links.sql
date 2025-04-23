-- Add creator_id column to links and backfill with user_id
ALTER TABLE links ADD COLUMN IF NOT EXISTS creator_id uuid references profiles(id);
UPDATE links SET creator_id = user_id WHERE creator_id IS NULL;
