-- Add removed_by_creator field to link_refs table
ALTER TABLE link_refs ADD COLUMN IF NOT EXISTS removed_by_creator BOOLEAN DEFAULT FALSE;

-- Backfill: set removed_by_creator = false for all existing records
UPDATE link_refs SET removed_by_creator = FALSE WHERE removed_by_creator IS NULL;
