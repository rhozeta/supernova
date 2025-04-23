-- Add user_id column to link_clicks table
ALTER TABLE link_clicks
ADD COLUMN user_id UUID;
