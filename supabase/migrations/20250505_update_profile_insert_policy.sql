-- Drop the existing insert policy
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;

-- Create a simpler insert policy for authenticated users
-- Note: Profile creation during signup is handled by the service role client
CREATE POLICY "Users can insert their own profile"
ON profiles FOR INSERT
WITH CHECK (auth.uid() = id);
