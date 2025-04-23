import { redirect } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

interface RedirectPageProps {
  params: Promise<{
    shortcode: string;
  }>;
}

export default async function RedirectPage({ params }: RedirectPageProps) {
  const { shortcode } = await params;
  
  // Find link by shortcode
  const { data: link, error } = await supabase
    .from('links')
    .select('*')
    .eq('short_code', shortcode)
    .single();
    
  if (error || !link) {
    // Redirect to home if link not found
    redirect('/');
  }
  
  // Increment click count
  await supabase
    .from('links')
    .update({ click_count: (link.click_count || 0) + 1 })
    .eq('id', link.id);
    
  // Increment user points
  await supabase
    .from('profiles')
    .update({ points: (link.user_id && link.click_count !== undefined) ? link.click_count + 1 : 1 })
    .eq('id', link.user_id);
    
  // Redirect to the original URL
  redirect(link.original_url);
  
  // This return is never reached due to the redirect, but is needed for TypeScript
  return null;
}
