-- Migration to create the follows table for following creators
create table if not exists follows (
    id uuid primary key default gen_random_uuid(),
    follower_id uuid references profiles(id) on delete cascade not null,
    creator_id uuid references profiles(id) on delete cascade not null,
    created_at timestamp with time zone default timezone('utc', now()) not null,
    unique (follower_id, creator_id)
);

-- Optional: Indexes for fast lookup
create index if not exists idx_follows_follower_id on follows(follower_id);
create index if not exists idx_follows_creator_id on follows(creator_id);
