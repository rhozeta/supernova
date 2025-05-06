-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE links ENABLE ROW LEVEL SECURITY;
ALTER TABLE link_refs ENABLE ROW LEVEL SECURITY;
ALTER TABLE link_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

-- Profiles policies
-- Note: Some profile policies already exist in 20250505_add_profile_policies.sql
CREATE POLICY "Users can delete own profile"
ON profiles FOR DELETE
USING (auth.uid() = id);

-- Storage bucket policies
-- Note: Some storage policies already exist in 20250505_add_profile_policies.sql
CREATE POLICY "Profile images are publicly accessible."
ON storage.objects FOR SELECT
USING (bucket_id = 'profile-images');

CREATE POLICY "Users can delete their own avatar image."
ON storage.objects FOR DELETE
USING (
    bucket_id = 'profile-images' AND
    auth.uid()::text = (storage.foldername(name))[1]
);

-- Links policies
CREATE POLICY "Links are viewable by everyone"
ON links FOR SELECT
USING (true);

CREATE POLICY "Users can insert their own links"
ON links FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own links"
ON links FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own links"
ON links FOR DELETE
USING (auth.uid() = user_id);

-- Link refs policies
CREATE POLICY "Link refs are viewable by link owner or ref owner"
ON link_refs FOR SELECT
USING (
  auth.uid() IN (
    user_id,  -- ref owner
    (SELECT user_id FROM links WHERE id = link_refs.original_link_id)  -- original link owner
  )
);

CREATE POLICY "Users can create link refs"
ON link_refs FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own link refs"
ON link_refs FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own link refs"
ON link_refs FOR DELETE
USING (auth.uid() = user_id);

-- Link clicks policies
CREATE POLICY "Link clicks are viewable by link owner or clicker"
ON link_clicks FOR SELECT
USING (
  auth.uid() IN (
    user_id,  -- click owner
    (SELECT user_id FROM links WHERE id = link_clicks.link_id)  -- link owner
  )
);

CREATE POLICY "Anyone can insert link clicks"
ON link_clicks FOR INSERT
WITH CHECK (true);

CREATE POLICY "Link owners can update click counts"
ON link_clicks FOR UPDATE
USING (
  auth.uid() = (SELECT user_id FROM links WHERE id = link_clicks.link_id)
);

-- Follows policies
CREATE POLICY "Follows are viewable by follower and creator"
ON follows FOR SELECT
USING (
  auth.uid() IN (follower_id, creator_id)
);

CREATE POLICY "Users can create follows"
ON follows FOR INSERT
WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can delete their own follows"
ON follows FOR DELETE
USING (auth.uid() = follower_id);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS links_user_id_idx ON links (user_id);
CREATE INDEX IF NOT EXISTS link_refs_user_id_idx ON link_refs (user_id);
CREATE INDEX IF NOT EXISTS link_refs_original_link_id_idx ON link_refs (original_link_id);
CREATE INDEX IF NOT EXISTS link_clicks_link_id_idx ON link_clicks (link_id);

CREATE INDEX IF NOT EXISTS follows_follower_id_idx ON follows (follower_id);
CREATE INDEX IF NOT EXISTS follows_creator_id_idx ON follows (creator_id);
