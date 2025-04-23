-- Add deleted field to links table
ALTER TABLE links ADD COLUMN IF NOT EXISTS deleted BOOLEAN DEFAULT FALSE;

-- Update existing records to have deleted = false
UPDATE links SET deleted = FALSE WHERE deleted IS NULL;
