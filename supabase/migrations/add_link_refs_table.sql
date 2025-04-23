-- Migration: Create link_refs table
CREATE TABLE IF NOT EXISTS link_refs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
    original_link_id uuid REFERENCES links(id) ON DELETE CASCADE,
    original_url text NOT NULL,
    short_code text NOT NULL,
    utm_param text,
    page_title text,
    page_image text,
    page_favicon text,
    page_description text,
    click_count integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    deleted boolean DEFAULT false
);
-- Index for quick lookup
CREATE INDEX IF NOT EXISTS idx_link_refs_user_id ON link_refs(user_id);
CREATE INDEX IF NOT EXISTS idx_link_refs_original_link_id ON link_refs(original_link_id);
