"use client";
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { toast, Toaster } from 'react-hot-toast';



export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [points, setPoints] = useState<number>(0);
  const [profile, setProfile] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [username, setUsername] = useState('');
  const [usernameError, setUsernameError] = useState('');

  const router = useRouter();

  // Get profile user from query param or session (for now, use session user)
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      setUser(user);
      
      // Fetch profile data
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (profileData) {
        setProfile(profileData);
        setUsername(profileData.username || '');
      }
    };
    getUser();
  }, [router]);

  useEffect(() => {
    if (user) fetchPoints();
    // eslint-disable-next-line
  }, [user]);

  const fetchPoints = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('points')
      .eq('id', user.id)
      .single();
    if (!error && data) setPoints(data.points);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);

      if (!event.target.files || event.target.files.length === 0) {
        throw new Error('You must select an image to upload.');
      }

      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/${Math.random()}.${fileExt}`;

      // Upload image to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('profile-images')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('profile-images')
        .getPublicUrl(filePath);

      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (updateError) {
        throw updateError;
      }

      // Update local state
      setProfile({ ...profile, avatar_url: publicUrl });
      toast.success('Avatar updated successfully!');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <Toaster position="bottom-right" />
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-xl shadow-md p-8 border border-gray-100 dark:border-gray-700">
          <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white text-center">Profile</h1>
          
          {/* Profile Image Section */}
          <div className="flex flex-col items-center mb-6">
            <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700 mb-4">
              {profile?.avatar_url ? (
                <img 
                  src={profile.avatar_url} 
                  alt="Profile" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 text-gray-400">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                </div>
              )}
            </div>
            
            <label className="relative cursor-pointer">
              <span className="btn-accent py-2 px-4 rounded-lg font-semibold inline-block">
                {uploading ? 'Uploading...' : 'Upload Avatar'}
              </span>
              <input
                type="file"
                accept="image/*"
                onChange={uploadAvatar}
                disabled={uploading}
                className="hidden"
              />
            </label>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Username</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={username}
                onChange={(e) => {
                  const value = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
                  setUsername(value);
                  setUsernameError('');
                }}
                placeholder="your-username"
                className="flex-1 px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 dark:text-white"
              />
              <button
                onClick={async () => {
                  if (!username) {
                    setUsernameError('Username is required');
                    return;
                  }

                  // Check if username is already taken
                  const { data: existingUser } = await supabase
                    .from('profiles')
                    .select('id')
                    .eq('username', username)
                    .neq('id', user.id)
                    .maybeSingle();

                  if (existingUser) {
                    setUsernameError('This username is already taken');
                    return;
                  }

                  // Update username
                  const { error: updateError } = await supabase
                    .from('profiles')
                    .update({ username })
                    .eq('id', user.id);

                  if (updateError) {
                    toast.error('Error updating username');
                  } else {
                    toast.success('Username updated successfully!');
                    setProfile({ ...profile, username });
                  }
                }}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
              >
                Save
              </button>
            </div>
            {usernameError && (
              <p className="mt-1 text-sm text-red-500">{usernameError}</p>
            )}
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              This will be your public profile URL: {window.location.origin}/creator/{username || '[username]'}
            </p>
          </div>

          <div className="mb-4 text-gray-700 dark:text-gray-300">Email: <span className="font-semibold text-gray-900 dark:text-white">{user?.email}</span></div>
          <div className="mb-6 text-gray-700 dark:text-gray-300">Qubits: <span className="font-semibold text-orange-500">{points}</span></div>
          <button
            onClick={handleLogout}
            className="w-full btn-accent py-2 px-4 rounded-lg font-semibold"
          >
            Log Out
          </button>
        </div>
      </div>
    </>
  );
}