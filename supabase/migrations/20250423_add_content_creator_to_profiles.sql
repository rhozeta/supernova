-- Add content_creator field to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS content_creator BOOLEAN DEFAULT FALSE;

-- Update existing records to have content_creator = false if null
UPDATE profiles SET content_creator = FALSE WHERE content_creator IS NULL;
