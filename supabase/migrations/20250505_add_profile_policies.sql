-- Enable RLS on profiles table if not already enabled
alter table profiles enable row level security;

-- Create policies for the profiles table
create policy "Public profiles are viewable by everyone."
  on profiles for select
  using ( true );

create policy "Users can update own profile."
  on profiles for update
  using ( auth.uid() = id );

-- Create policy for profile-images storage
create policy "Users can update their own avatar image."
  on storage.objects for insert
  with check (
    bucket_id = 'profile-images' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
