import { redirect } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

export default async function ShortCodeRedirectPage({ params }: { params: Promise<{ short_code: string }> }) {
  const { short_code } = await params;
  // Fetch the link data
  const { data, error } = await supabase
    .from('links')
    .select('original_url, deleted')
    .eq('short_code', short_code)
    .single();

  if (error || !data?.original_url) {
    // Optionally, render a 404 page or error message
    return <div>Link not found</div>;
  }
  
  // Check if link is deleted
  if (data.deleted === true) {
    // Redirect to login page if link is deleted
    redirect('/login');
  }

  // Increment click_count atomically
  await supabase.rpc('increment_click_count', { link_short_code: short_code });

  redirect(data.original_url);
  return null;
}
