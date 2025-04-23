# Supabase schema for Link Shortener

-- Users table (Supabase Auth handles most user info)
-- We'll use a 'profiles' table for extra info like points
create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  username text unique,
  points integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Links table
create table if not exists links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  original_url text not null,
  short_code text unique not null,
  click_count integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now())
);
