import { redirect } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import { trackLinkClick } from '../../lib/trackLinkClick';

interface RedirectPageProps {
  params: {
    shortcode: string;
  };
}

export default async function RedirectPage({ params }: RedirectPageProps) {
  // Ensure params is fully resolved before destructuring
  const resolvedParams = await Promise.resolve(params);
  const { shortcode } = resolvedParams;
  
  console.log(`[RedirectPage] Processing shortcode: ${shortcode}`);
  
  // Find link by shortcode
  const { data: link, error } = await supabase
    .from('links')
    .select('*')
    .eq('short_code', shortcode)
    .single();
    
  console.log(`[RedirectPage] Link data:`, link ? { id: link.id, short_code: link.short_code, deleted: link.deleted } : 'Not found');
  
  if (error) {
    console.log(`[RedirectPage] Link not found for shortcode: ${shortcode}`);
    // This is an expected path for non-existent shortcodes
    return redirect('/404');
  }
  
  if (!link) {
    console.log(`[RedirectPage] Link is null for shortcode: ${shortcode}`);
    return redirect('/404');
  }
  
  // Check if link is deleted
  if (link.deleted === true) {
    console.log(`[RedirectPage] Link is deleted, redirecting to login`);
    return redirect('/login');
  }
  
  // Track the click with detailed logging
  console.log(`[RedirectPage] Tracking click for link ID: ${link.id}, shortcode: ${shortcode}`);
  
  try {
    // First, directly insert into link_clicks table
    const { data: clickData, error: clickError } = await supabase
      .from('link_clicks')
      .insert({
        link_id: link.id,
        clicked_at: new Date().toISOString()
        // No other fields required - referrer, user_agent, ip_address, and country are optional
      });
      
    console.log(`[RedirectPage] Direct insert result:`, clickError ? `Failed: ${clickError.message}` : 'Success');
    
    // Also try the trackLinkClick function as a backup
    await trackLinkClick(link.id, shortcode);
    
    // Manually update the click count as a fallback
    await supabase
      .from('links')
      .update({ click_count: (link.click_count || 0) + 1 })
      .eq('id', link.id);
  } catch (trackError) {
    // Log but continue - tracking errors shouldn't prevent redirection
    console.error(`[RedirectPage] Error tracking click:`, trackError);
  }

  console.log(`[RedirectPage] Redirecting to: ${link.original_url}`);
  // Redirect to the original URL
  return redirect(link.original_url);
  
  // This return is never reached due to the redirect, but is needed for TypeScript
  return null;
}
