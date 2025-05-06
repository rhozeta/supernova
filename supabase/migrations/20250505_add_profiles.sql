-- Add avatar_url column to existing profiles table
alter table profiles
add column if not exists avatar_url text;

-- Add updated_at column if it doesn't exist
alter table profiles
add column if not exists updated_at timestamp with time zone default timezone('utc'::text, now());