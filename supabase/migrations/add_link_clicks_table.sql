-- Create a new table to track individual link clicks
CREATE TABLE IF NOT EXISTS link_clicks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  link_id UUID NOT NULL REFERENCES links(id) ON DELETE CASCADE,
  clicked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  referrer TEXT,
  user_agent TEXT,
  ip_address TEXT,
  country TEXT
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS link_clicks_link_id_idx ON link_clicks(link_id);
CREATE INDEX IF NOT EXISTS link_clicks_clicked_at_idx ON link_clicks(clicked_at);

-- Add a function to update the click_count in the links table
CREATE OR REPLACE FUNCTION update_link_click_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE links
  SET click_count = (SELECT COUNT(*) FROM link_clicks WHERE link_id = NEW.link_id)
  WHERE id = NEW.link_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to automatically update click_count when a new click is recorded
DROP TRIGGER IF EXISTS update_link_click_count_trigger ON link_clicks;
CREATE TRIGGER update_link_click_count_trigger
AFTER INSERT ON link_clicks
FOR EACH ROW
EXECUTE FUNCTION update_link_click_count();
