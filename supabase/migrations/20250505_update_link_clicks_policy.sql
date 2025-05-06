-- Drop the existing select policy for link_clicks
DROP POLICY IF EXISTS "Link clicks are viewable by link owner or clicker" ON link_clicks;

-- Create a new policy that allows public read access to link_clicks
-- This is needed for the trending links page to work
CREATE POLICY "Link clicks are publicly viewable"
ON link_clicks FOR SELECT
USING (true);

-- Note: The insert and update policies remain unchanged:
-- "Anyone can insert link clicks" and "Link owners can update click counts"
