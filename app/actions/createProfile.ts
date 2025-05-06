'use server';

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase admin client with service role key
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export async function createProfile(profileData: {
  id: string;
  username: string;
  content_creator: boolean;
}) {
  try {
    const { error } = await supabaseAdmin.from('profiles').insert({
      id: profileData.id,
      username: profileData.username,
      points: 0,
      content_creator: profileData.content_creator,
      created_at: new Date().toISOString(),
    });

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error creating profile:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error occurred' };
  }
}
